import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';

import mockAppContext, {
  mockClientSession,
} from '@app/context/contracts/__mocks__/app-context.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import mockBalanceSeriesQueryRepo from '@app/reporting/contracts/__mocks__/balance-series.query.repo.mock';
import reportingError from '@app/reporting/errors/reporting.error';
import makeGetBalancesByAccountUsecase from '@app/reporting/usecases/get-balances-by-account.usecase';
import makeGetBalancesByBehaviorUsecase from '@app/reporting/usecases/get-balances-by-behavior.usecase';
import makeGetBalancesBySubTypeUsecase from '@app/reporting/usecases/get-balances-by-sub-type.usecase';
import makeGetBalancesByTypeUsecase from '@app/reporting/usecases/get-balances-by-type.usecase';

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
  balanceSeriesQueryRepo: mockBalanceSeriesQueryRepo,
  ledgerAccountRepo: mockLedgerAccountRepo,
};

describe('closing balance use cases', () => {
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
    mockBalanceSeriesQueryRepo.aggregate.mockResolvedValue([
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
  describe('by Type', () => {
    const usecase = makeGetBalancesByTypeUsecase(deps);
    const query = { ...period, types: ['asset'] } as Parameters<
      typeof usecase
    >[0];
    it('deduplicates filters, scopes the query, and returns only its concrete DTO fields', async () => {
      const report = await usecase({ ...query, types: ['asset', 'asset'] });
      expect(mockBalanceSeriesQueryRepo.aggregate).toHaveBeenCalledWith(
        {
          accountingEntityId: entityId,
          currencyCode: 'NGN',
          period: { from: new Date(period.from), to: new Date(period.to) },
          bucketDays: 4,
          filter: { types: ['asset'] },
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
          ...{ type: 'asset' },
          closingBalance: {
            amount: 900,
            currencyCode: 'NGN',
            isMinorUnit: true,
          },
        },
      ]);
    });
    it('rejects invalid filters before reading context or storage', async () => {
      await expect(usecase({ ...query, types: [] })).rejects.toThrow(
        appError.UnprocessableEntity
      );
      expect(mockAppContext.get).not.toHaveBeenCalled();
      expect(mockBalanceSeriesQueryRepo.aggregate).not.toHaveBeenCalled();
    });
    it('rejects reversed and excessive ranges before storage', async () => {
      await expect(usecase({ ...query, to: '2025-12-31' })).rejects.toThrow(
        reportingError.InvalidPeriod
      );
      await expect(
        usecase({ ...query, from: '2024-01-01', to: '2025-01-01' })
      ).rejects.toThrow(reportingError.ReportPeriodLimitExceeded);
      expect(mockBalanceSeriesQueryRepo.aggregate).not.toHaveBeenCalled();
    });
    it('propagates a failed read without a partial report', async () => {
      const failure = new Error('read failed');
      mockBalanceSeriesQueryRepo.aggregate.mockRejectedValue(failure);
      await expect(usecase(query)).rejects.toBe(failure);
    });
  });
  describe('by SubType', () => {
    const usecase = makeGetBalancesBySubTypeUsecase(deps);
    const query = {
      ...period,
      subTypes: ['cash_and_cash_equivalent'],
    } as Parameters<typeof usecase>[0];
    it('deduplicates filters, scopes the query, and returns only its concrete DTO fields', async () => {
      const report = await usecase({
        ...query,
        subTypes: ['cash_and_cash_equivalent', 'cash_and_cash_equivalent'],
      });
      expect(mockBalanceSeriesQueryRepo.aggregate).toHaveBeenCalledWith(
        {
          accountingEntityId: entityId,
          currencyCode: 'NGN',
          period: { from: new Date(period.from), to: new Date(period.to) },
          bucketDays: 4,
          filter: { subTypes: ['cash_and_cash_equivalent'] },
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
          ...{ type: 'asset', subType: 'cash_and_cash_equivalent' },
          closingBalance: {
            amount: 900,
            currencyCode: 'NGN',
            isMinorUnit: true,
          },
        },
      ]);
    });
    it('rejects invalid filters before reading context or storage', async () => {
      await expect(usecase({ ...query, subTypes: [] })).rejects.toThrow(
        appError.UnprocessableEntity
      );
      expect(mockAppContext.get).not.toHaveBeenCalled();
      expect(mockBalanceSeriesQueryRepo.aggregate).not.toHaveBeenCalled();
    });
    it('rejects reversed and excessive ranges before storage', async () => {
      await expect(usecase({ ...query, to: '2025-12-31' })).rejects.toThrow(
        reportingError.InvalidPeriod
      );
      await expect(
        usecase({ ...query, from: '2024-01-01', to: '2025-01-01' })
      ).rejects.toThrow(reportingError.ReportPeriodLimitExceeded);
      expect(mockBalanceSeriesQueryRepo.aggregate).not.toHaveBeenCalled();
    });
    it('propagates a failed read without a partial report', async () => {
      const failure = new Error('read failed');
      mockBalanceSeriesQueryRepo.aggregate.mockRejectedValue(failure);
      await expect(usecase(query)).rejects.toBe(failure);
    });
  });
  describe('by Behavior', () => {
    const usecase = makeGetBalancesByBehaviorUsecase(deps);
    const query = { ...period, behaviors: ['bank'] } as Parameters<
      typeof usecase
    >[0];
    it('deduplicates filters, scopes the query, and returns only its concrete DTO fields', async () => {
      const report = await usecase({ ...query, behaviors: ['bank', 'bank'] });
      expect(mockBalanceSeriesQueryRepo.aggregate).toHaveBeenCalledWith(
        {
          accountingEntityId: entityId,
          currencyCode: 'NGN',
          period: { from: new Date(period.from), to: new Date(period.to) },
          bucketDays: 4,
          filter: { behaviors: ['bank'] },
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
          ...{
            type: 'asset',
            subType: 'cash_and_cash_equivalent',
            behavior: 'bank',
          },
          closingBalance: {
            amount: 900,
            currencyCode: 'NGN',
            isMinorUnit: true,
          },
        },
      ]);
    });
    it('rejects invalid filters before reading context or storage', async () => {
      await expect(usecase({ ...query, behaviors: [] })).rejects.toThrow(
        appError.UnprocessableEntity
      );
      expect(mockAppContext.get).not.toHaveBeenCalled();
      expect(mockBalanceSeriesQueryRepo.aggregate).not.toHaveBeenCalled();
    });
    it('rejects reversed and excessive ranges before storage', async () => {
      await expect(usecase({ ...query, to: '2025-12-31' })).rejects.toThrow(
        reportingError.InvalidPeriod
      );
      await expect(
        usecase({ ...query, from: '2024-01-01', to: '2025-01-01' })
      ).rejects.toThrow(reportingError.ReportPeriodLimitExceeded);
      expect(mockBalanceSeriesQueryRepo.aggregate).not.toHaveBeenCalled();
    });
    it('propagates a failed read without a partial report', async () => {
      const failure = new Error('read failed');
      mockBalanceSeriesQueryRepo.aggregate.mockRejectedValue(failure);
      await expect(usecase(query)).rejects.toBe(failure);
    });
  });
  describe('by Account', () => {
    const usecase = makeGetBalancesByAccountUsecase(deps);
    const query = { ...period, accountIds: [accountId] } as Parameters<
      typeof usecase
    >[0];
    it('deduplicates filters, scopes the query, and returns only its concrete DTO fields', async () => {
      const report = await usecase({
        ...query,
        accountIds: [accountId, accountId],
      });
      expect(mockBalanceSeriesQueryRepo.aggregate).toHaveBeenCalledWith(
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
      expect(mockBalanceSeriesQueryRepo.aggregate).not.toHaveBeenCalled();
    });
    it('rejects reversed and excessive ranges before storage', async () => {
      await expect(usecase({ ...query, to: '2025-12-31' })).rejects.toThrow(
        reportingError.InvalidPeriod
      );
      await expect(
        usecase({ ...query, from: '2024-01-01', to: '2025-01-01' })
      ).rejects.toThrow(reportingError.ReportPeriodLimitExceeded);
      expect(mockBalanceSeriesQueryRepo.aggregate).not.toHaveBeenCalled();
    });
    it('propagates a failed read without a partial report', async () => {
      const failure = new Error('read failed');
      mockBalanceSeriesQueryRepo.aggregate.mockRejectedValue(failure);
      await expect(usecase(query)).rejects.toBe(failure);
    });
  });
  describe('account ownership and eligibility', () => {
    const usecase = makeGetBalancesByAccountUsecase(deps);
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
      expect(mockBalanceSeriesQueryRepo.aggregate).not.toHaveBeenCalled();
    });
    it('accepts control accounts and preserves overlapping parent and child requests', async () => {
      mockLedgerAccountRepo.findById
        .mockResolvedValueOnce({ ...account, isControlAccount: true })
        .mockResolvedValueOnce({ ...account, id: entityId });
      mockBalanceSeriesQueryRepo.aggregate.mockResolvedValue([
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
      expect(mockBalanceSeriesQueryRepo.aggregate).toHaveBeenCalledWith(
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
      expect(mockBalanceSeriesQueryRepo.aggregate).not.toHaveBeenCalled();
    });
  });
});
