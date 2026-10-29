import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { ELedgerType } from '@domain/ledger/types/ledger.types';

import mockAppContext, {
  mockClientSession,
} from '@app/context/contracts/__mocks__/app-context.mock';
import reportingError from '@app/ledger/errors/reporting.error';

import makeGetAccountActivityByTypesUsecase, {
  TGetAccountActivityByTypesRepoQuery,
} from './account-activity-by-types.usecase';
import { IGetAccountActivityByTypesQuery } from './dto';

const repoQuery: jest.MockedFunction<TGetAccountActivityByTypesRepoQuery> =
  jest.fn();
const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const query: IGetAccountActivityByTypesQuery = {
  from: '2026-10-01',
  to: '2026-10-05',
  bucketDays: 2,
  types: ['revenue', 'expense'],
};
const usecase = makeGetAccountActivityByTypesUsecase({
  appContext: mockAppContext,
  repoQuery,
});
const money = (amount: number) => ({
  amount,
  currencyCode: 'NGN',
  isMinorUnit: true,
});

describe('getAccountActivityByTypesUsecase', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      accountingEntity: {
        id: entityId,
        functionalCurrencyCode: 'NGN',
      } as IAccountingEntity,
      correlationId: 'activity-spec',
      idempotencyKey: '',
      clientSession: mockClientSession,
    });
    repoQuery.mockResolvedValue([]);
  });

  it('scopes and deduplicates filters, fills gaps and clips the final bucket', async () => {
    repoQuery.mockResolvedValue([
      { type: 'revenue', bucketIndex: 0, debits: 120n, credits: 100n },
      { type: 'expense', bucketIndex: 2, debits: 50n, credits: 80n },
    ]);
    const report = await usecase({
      ...query,
      types: ['revenue', 'expense', 'revenue'],
    });
    expect(Object.isFrozen(repoQuery.mock.calls[0][0].period)).toBe(true);
    expect(repoQuery).toHaveBeenCalledWith(
      {
        accountingEntityId: entityId,
        currencyCode: 'NGN',
        period: { from: new Date(query.from), to: new Date(query.to) },
        bucketDays: 2,
        types: ['expense', 'revenue'],
      },
      { correlationId: 'activity-spec' }
    );
    expect(report).toEqual({
      currencyCode: 'NGN',
      period: { from: query.from, to: query.to },
      buckets: [
        {
          from: '2026-10-01',
          to: '2026-10-02',
          activity: [
            {
              type: 'expense',
              totalDebits: money(0),
              totalCredits: money(0),
              delta: money(0),
            },
            {
              type: 'revenue',
              totalDebits: money(120),
              totalCredits: money(100),
              delta: money(-20),
            },
          ],
        },
        {
          from: '2026-10-03',
          to: '2026-10-04',
          activity: [
            {
              type: 'expense',
              totalDebits: money(0),
              totalCredits: money(0),
              delta: money(0),
            },
            {
              type: 'revenue',
              totalDebits: money(0),
              totalCredits: money(0),
              delta: money(0),
            },
          ],
        },
        {
          from: '2026-10-05',
          to: '2026-10-05',
          activity: [
            {
              type: 'expense',
              totalDebits: money(50),
              totalCredits: money(80),
              delta: money(-30),
            },
            {
              type: 'revenue',
              totalDebits: money(0),
              totalCredits: money(0),
              delta: money(0),
            },
          ],
        },
      ],
    });
  });

  it('uses type normal sides for all five types', async () => {
    const types = Object.values(ELedgerType);
    repoQuery.mockResolvedValue(
      types.map((type) => ({
        type,
        bucketIndex: 0,
        debits: 100n,
        credits: 30n,
      }))
    );
    const report = await usecase({ ...query, types });
    expect(
      report.buckets[0].activity.map((row) => [row.type, row.delta.amount])
    ).toEqual([
      ['asset', 70],
      ['equity', -70],
      ['expense', 70],
      ['liability', -70],
      ['revenue', -70],
    ]);
  });

  it.each([
    ['2024-02-28', '2024-03-01', 1, 3],
    ['2026-10-01', '2026-10-01', 10, 1],
    ['2024-01-01', '2024-12-31', 1, 366],
    ['0001-01-01', '0001-01-01', Number.MAX_SAFE_INTEGER, 1],
  ])(
    'zero-fills inclusive calendar dates %s to %s',
    async (from, to, bucketDays, count) => {
      const report = await usecase({ ...query, from, to, bucketDays });
      expect(report.buckets).toHaveLength(count);
      expect(report.buckets[0].from).toBe(from);
      expect(report.buckets[count - 1].to).toBe(to);
      expect(
        report.buckets.every(
          (bucket) =>
            bucket.activity.length === 2 &&
            bucket.activity.every((row) => row.delta.amount === 0)
        )
      ).toBe(true);
    }
  );

  it.each([
    { from: '2026-02-30' },
    { to: '0000-01-01' },
    { bucketDays: 0 },
    { bucketDays: -1 },
    { bucketDays: 1.5 },
    { bucketDays: Infinity },
    { bucketDays: Number.MAX_SAFE_INTEGER + 1 },
    { types: [] },
    { types: ['invalid'] },
    { types: undefined },
  ])(
    'rejects malformed requests before context or storage: %j',
    async (invalid) => {
      await expect(
        usecase({ ...query, ...invalid } as IGetAccountActivityByTypesQuery)
      ).rejects.toThrow(appError.UnprocessableEntity);
      expect(mockAppContext.get).not.toHaveBeenCalled();
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
    await expect(usecase({ ...query, ...invalid })).rejects.toThrow(error);
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
      repoQuery.mockResolvedValue([
        { type: 'revenue', bucketIndex: 0, debits, credits },
      ]);
      await expect(usecase(query)).rejects.toThrow(error);
    }
  );

  it('propagates storage failures without a partial report', async () => {
    const failure = new Error('read failed');
    repoQuery.mockRejectedValue(failure);
    await expect(usecase(query)).rejects.toBe(failure);
  });
});
