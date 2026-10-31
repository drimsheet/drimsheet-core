import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';

import mockAppContext, {
  mockClientSession,
} from '@app/context/contracts/__mocks__/app-context.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import reportingError from '@app/ledger/errors/reporting.error';

import makeGetAccountActivityUsecase, {
  TGetAccountActivityRepoQuery,
} from './account-activity.usecase';
import { IGetAccountActivityQuery } from './dto';

const repoQuery: jest.MockedFunction<TGetAccountActivityRepoQuery> = jest.fn();
const accountId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const account = {
  id: accountId,
  accountingEntityId: entityId,
  type: 'asset',
  normalBalance: 'debit',
  isControlAccount: true,
  status: 'active',
} as ILedgerAccount;
const query: IGetAccountActivityQuery = {
  from: '2026-10-01',
  to: '2026-10-05',
  bucketDays: 2,
};
const usecase = makeGetAccountActivityUsecase({
  appContext: mockAppContext,
  ledgerAccountRepo: mockLedgerAccountRepo,
  repoQuery,
});
const money = (amount: number) => ({
  amount,
  currencyCode: 'NGN',
  isMinorUnit: true,
});

describe('getAccountActivityUsecase', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      accountingEntity: {
        id: entityId,
        functionalCurrencyCode: 'NGN',
      } as IAccountingEntity,
      correlationId: 'account-activity-spec',
      idempotencyKey: '',
      clientSession: mockClientSession,
    });
    mockLedgerAccountRepo.findById.mockResolvedValue(account);
    repoQuery.mockResolvedValue([]);
  });

  it('scopes account reads, fills gaps and clips the final bucket', async () => {
    repoQuery.mockResolvedValue([
      { bucketIndex: 2, debits: 50n, credits: 80n },
      { bucketIndex: 0, debits: 120n, credits: 100n },
    ]);
    const report = await usecase(accountId, query);
    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
      accountId,
      entityId,
      { correlationId: 'account-activity-spec' }
    );
    expect(Object.isFrozen(repoQuery.mock.calls[0][0].period)).toBe(true);
    expect(repoQuery).toHaveBeenCalledWith(
      {
        accountId,
        accountingEntityId: entityId,
        currencyCode: 'NGN',
        period: { from: new Date(query.from), to: new Date(query.to) },
        bucketDays: 2,
      },
      { correlationId: 'account-activity-spec' }
    );
    expect(report).toEqual({
      accountId,
      currencyCode: 'NGN',
      period: { from: query.from, to: query.to },
      buckets: [
        {
          from: '2026-10-01',
          to: '2026-10-02',
          totalDebits: money(120),
          totalCredits: money(100),
          delta: money(20),
        },
        {
          from: '2026-10-03',
          to: '2026-10-04',
          totalDebits: money(0),
          totalCredits: money(0),
          delta: money(0),
        },
        {
          from: '2026-10-05',
          to: '2026-10-05',
          totalDebits: money(50),
          totalCredits: money(80),
          delta: money(-30),
        },
      ],
    });
  });

  it.each([
    ['asset', 'credit', -70],
    ['revenue', 'debit', 70],
    ['revenue', 'credit', -70],
  ] as const)(
    'uses the selected %s account normal side %s, including contra accounts',
    async (type, normalBalance, delta) => {
      mockLedgerAccountRepo.findById.mockResolvedValue({
        ...account,
        type,
        normalBalance,
        isControlAccount: false,
      });
      repoQuery.mockResolvedValue([
        { bucketIndex: 0, debits: 100n, credits: 30n },
      ]);
      const report = await usecase(accountId, query);
      expect(report.buckets[0].delta).toEqual(money(delta));
    }
  );

  it.each(['archived', 'draft'] as const)(
    'retains %s accounts for historical reporting',
    async (status) => {
      mockLedgerAccountRepo.findById.mockResolvedValue({ ...account, status });
      await expect(usecase(accountId, query)).resolves.toHaveProperty(
        'buckets'
      );
    }
  );

  it.each([
    ['2024-02-28', '2024-03-01', 1, 3],
    ['2026-10-01', '2026-10-01', 10, 1],
    ['2024-01-01', '2024-12-31', 1, 366],
    ['0001-01-01', '0001-01-01', Number.MAX_SAFE_INTEGER, 1],
  ])(
    'zero-fills inclusive calendar dates %s to %s',
    async (from, to, bucketDays, count) => {
      const report = await usecase(accountId, {
        ...query,
        from,
        to,
        bucketDays,
      });
      expect(report.buckets).toHaveLength(count);
      expect(report.buckets[0].from).toBe(from);
      expect(report.buckets[count - 1].to).toBe(to);
      expect(
        report.buckets.every(
          (bucket) =>
            bucket.totalDebits.amount === 0 &&
            bucket.totalCredits.amount === 0 &&
            bucket.delta.amount === 0
        )
      ).toBe(true);
    }
  );

  it('rejects invalid account IDs before context or storage', async () => {
    await expect(usecase('bad-id', query)).rejects.toThrow(
      reportingError.InvalidAccountId
    );
    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
  });

  it.each([
    { from: '2026-02-30' },
    { to: '0000-01-01' },
    { bucketDays: 0 },
    { bucketDays: -1 },
    { bucketDays: 1.5 },
    { bucketDays: Infinity },
    { bucketDays: Number.MAX_SAFE_INTEGER + 1 },
    { bucketDays: undefined },
  ])(
    'rejects malformed requests before context or storage: %j',
    async (invalid) => {
      await expect(
        usecase(accountId, { ...query, ...invalid } as IGetAccountActivityQuery)
      ).rejects.toThrow(appError.UnprocessableEntity);
      expect(mockAppContext.get).not.toHaveBeenCalled();
      expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
      expect(repoQuery).not.toHaveBeenCalled();
    }
  );

  it.each([
    [{ to: '2026-09-30' }, reportingError.InvalidPeriod],
    [
      { from: '2024-01-01', to: '2025-01-01' },
      reportingError.ReportPeriodLimitExceeded,
    ],
  ])('rejects unsupported ranges %j', async (invalid, error) => {
    await expect(usecase(accountId, { ...query, ...invalid })).rejects.toThrow(
      error
    );
    expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
    expect(repoQuery).not.toHaveBeenCalled();
  });

  it('rejects missing or foreign accounts before aggregation', async () => {
    mockLedgerAccountRepo.findById.mockResolvedValue(null);
    await expect(usecase(accountId, query)).rejects.toThrow(
      reportingError.AccountNotFound
    );
    expect(repoQuery).not.toHaveBeenCalled();
  });

  it.each([
    [-1n, 0n, reportingError.AmountOutOfRange],
    [0n, -1n, reportingError.AmountOutOfRange],
    [100_000_000_000_001n, 0n, reportingError.ReportAmountLimitExceeded],
    [0n, 100_000_000_000_001n, reportingError.ReportAmountLimitExceeded],
  ])(
    'rejects invalid monetary aggregates %s/%s',
    async (debits, credits, error) => {
      repoQuery.mockResolvedValue([{ bucketIndex: 0, debits, credits }]);
      await expect(usecase(accountId, query)).rejects.toThrow(error);
    }
  );

  it('propagates account lookup failures without querying activity', async () => {
    const failure = new Error('lookup failed');
    mockLedgerAccountRepo.findById.mockRejectedValue(failure);
    await expect(usecase(accountId, query)).rejects.toBe(failure);
    expect(repoQuery).not.toHaveBeenCalled();
  });

  it('propagates aggregation failures without a partial report', async () => {
    const failure = new Error('read failed');
    repoQuery.mockRejectedValue(failure);
    await expect(usecase(accountId, query)).rejects.toBe(failure);
  });
});
