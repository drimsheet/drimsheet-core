import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';

import mockAppContext, {
  mockClientSession,
} from '@app/context/contracts/__mocks__/app-context.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import type { TBalanceHistoryRepoQuery } from '@app/ledger/contracts/balance-history.repo-query.contract';
import reportingError from '@app/ledger/errors/reporting.error';

import makeGetBalanceHistoryByAccountUsecase from './balance-history-by-account.usecase';
import * as schemas from './dto';

const mockBalanceHistoryRepoQuery: jest.MockedFunction<TBalanceHistoryRepoQuery> =
  jest.fn();
describe('getBalanceHistoryByAccountUsecase', () => {
  const accountId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const period = { from: '2026-01-01', to: '2026-01-10', bucketDays: 4 };
  const account = {
    id: accountId,
    accountingEntityId: entityId,
    isControlAccount: false,
    deletedAt: null,
  } as ILedgerAccount;
  const deps = {
    appContext: mockAppContext,
    repoQuery: mockBalanceHistoryRepoQuery,
    ledgerAccountRepo: mockLedgerAccountRepo,
  };
  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      accountingEntity: {
        id: entityId,
        functionalCurrencyCode: 'NGN',
      } as IAccountingEntity,
      correlationId: 'series-spec',
      idempotencyKey: '',
      clientSession: mockClientSession,
    });
    mockLedgerAccountRepo.findById.mockResolvedValue(account);
    mockBalanceHistoryRepoQuery.mockResolvedValue([
      {
        accountId,
        type: 'asset',
        subType: 'cash_and_cash_equivalent',
        behavior: 'bank',
        normalBalance: 'debit',
        bucketIndex: -1,
        debits: 1000n,
        credits: 100n,
      },
    ]);
  });
  describe('by Account', () => {
    const usecase = makeGetBalanceHistoryByAccountUsecase(deps);
    const query = { ...period, accountIds: [accountId] } as Parameters<
      typeof usecase
    >[0];
    it('deduplicates filters, scopes the query, and returns only its concrete DTO fields', async () => {
      const report = await usecase({
        ...query,
        accountIds: [accountId, accountId],
      });
      expect(mockBalanceHistoryRepoQuery).toHaveBeenCalledWith(
        {
          accountingEntityId: entityId,
          currencyCode: 'NGN',
          period: { from: new Date(period.from), to: new Date(period.to) },
          bucketDays: 4,
          filter: { accountIds: [accountId] },
        },
        { correlationId: 'series-spec' }
      );
      expect(report.period).toEqual({ from: period.from, to: period.to });
      expect(report.buckets.map((bucket) => bucket.date)).toEqual([
        '2026-01-04',
        '2026-01-08',
        '2026-01-10',
      ]);
      expect(report.buckets[0].balances).toEqual([
        {
          ...{ accountId },
          closingBalance: {
            amount: 900,
            currencyCode: 'NGN',
            isMinorUnit: true,
          },
        },
      ]);
    });
    it('rejects invalid filters before reading context or storage', async () => {
      await expect(usecase({ ...query, accountIds: [] })).rejects.toThrow(
        appError.UnprocessableEntity
      );
      expect(mockAppContext.get).not.toHaveBeenCalled();
      expect(mockBalanceHistoryRepoQuery).not.toHaveBeenCalled();
    });
    it('rejects reversed and excessive ranges before storage', async () => {
      await expect(usecase({ ...query, to: '2025-12-31' })).rejects.toThrow(
        reportingError.InvalidPeriod
      );
      await expect(
        usecase({ ...query, from: '2024-01-01', to: '2025-01-01' })
      ).rejects.toThrow(reportingError.ReportPeriodLimitExceeded);
      expect(mockBalanceHistoryRepoQuery).not.toHaveBeenCalled();
    });
    it('propagates a failed read without a partial report', async () => {
      const failure = new Error('read failed');
      mockBalanceHistoryRepoQuery.mockRejectedValue(failure);
      await expect(usecase(query)).rejects.toBe(failure);
    });
  });
  describe('account ownership and eligibility', () => {
    const usecase = makeGetBalanceHistoryByAccountUsecase(deps);
    it('checks each distinct account within the current entity', async () => {
      await usecase({ ...period, accountIds: [accountId, accountId] });
      expect(mockLedgerAccountRepo.findById).toHaveBeenCalledTimes(1);
      expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
        accountId,
        entityId,
        { correlationId: 'series-spec' }
      );
    });
    it('rejects an absent or foreign account before aggregation', async () => {
      mockLedgerAccountRepo.findById.mockResolvedValue(null);
      await expect(
        usecase({ ...period, accountIds: [accountId] })
      ).rejects.toThrow(reportingError.AccountNotFound);
      expect(mockBalanceHistoryRepoQuery).not.toHaveBeenCalled();
    });
    it('accepts control accounts and preserves overlapping parent and child requests', async () => {
      mockLedgerAccountRepo.findById
        .mockResolvedValueOnce({ ...account, isControlAccount: true })
        .mockResolvedValueOnce({ ...account, id: entityId });
      mockBalanceHistoryRepoQuery.mockResolvedValue([
        {
          accountId,
          type: 'asset',
          subType: 'cash_and_cash_equivalent',
          behavior: 'bank',
          normalBalance: 'debit',
          bucketIndex: -1,
          debits: 1000n,
          credits: 100n,
        },
        {
          accountId: entityId,
          type: 'asset',
          subType: 'cash_and_cash_equivalent',
          behavior: 'bank',
          normalBalance: 'debit',
          bucketIndex: -1,
          debits: 300n,
          credits: 0n,
        },
      ]);
      const report = await usecase({
        ...period,
        accountIds: [accountId, entityId],
      });
      expect(mockBalanceHistoryRepoQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: { accountIds: [accountId, entityId] },
        }),
        { correlationId: 'series-spec' }
      );
      expect(
        report.buckets[0].balances.map((balance) => [
          balance.accountId,
          balance.closingBalance.amount,
        ])
      ).toEqual([
        [accountId, 900],
        [entityId, 300],
      ]);
    });
    it.each(['archived', 'draft'] as const)(
      'retains %s posting accounts',
      async (status) => {
        mockLedgerAccountRepo.findById.mockResolvedValue({
          ...account,
          status,
        });
        await expect(
          usecase({ ...period, accountIds: [accountId] })
        ).resolves.toHaveProperty('buckets');
      }
    );
    it('does not return partial results when a later account is missing', async () => {
      mockLedgerAccountRepo.findById
        .mockResolvedValueOnce(account)
        .mockResolvedValueOnce(null);
      await expect(
        usecase({ ...period, accountIds: [accountId, entityId] })
      ).rejects.toThrow(reportingError.AccountNotFound);
      expect(mockBalanceHistoryRepoQuery).not.toHaveBeenCalled();
    });
  });
});
describe('getBalanceHistoryByAccountQueryValidationSchema', () => {
  const period = { from: '2026-01-01', to: '2026-01-31', bucketDays: 7 };
  const schema = schemas.getBalanceHistoryByAccountQueryValidationSchema;
  it('accepts the specific filter', () => {
    expect(
      schema.safeParse({
        ...period,
        accountIds: ['123e4567-e89b-12d3-a456-426614174001'],
      }).success
    ).toBe(true);
  });
  it.each([undefined, [], ['invalid'], '123e4567-e89b-12d3-a456-426614174001'])(
    'rejects malformed filters %j',
    (filter) => {
      expect(schema.safeParse({ ...period, accountIds: filter }).success).toBe(
        false
      );
    }
  );
  it.each([
    { from: '2026-02-30' },
    { to: '0000-01-01' },
    { bucketDays: 0 },
    { bucketDays: 1.5 },
    { bucketDays: Infinity },
  ])('rejects malformed dates and bucket sizes %j', (invalid) => {
    expect(
      schema.safeParse({
        ...period,
        accountIds: ['123e4567-e89b-12d3-a456-426614174001'],
        ...invalid,
      }).success
    ).toBe(false);
  });
});
