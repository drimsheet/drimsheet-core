import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

import mockAppContext, {
  mockClientSession,
} from '@app/context/contracts/__mocks__/app-context.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import type { TBalanceSeriesRepoQuery } from '@app/ledger/contracts/balance-series.repo-query.contract';
import { IBalanceSeriesRepoQueryOutput } from '@app/ledger/contracts/balance-series.repo-query.contract';
import reportingError from '@app/ledger/errors/reporting.error';
import makeGetBalancesByAccountUsecase from '@app/ledger/usecases/reporting/balances-by-account/balances-by-account.usecase';
import makeGetBalancesByBehaviorUsecase from '@app/ledger/usecases/reporting/balances-by-behavior/balances-by-behavior.usecase';
import makeGetBalancesBySubTypeUsecase from '@app/ledger/usecases/reporting/balances-by-sub-type/balances-by-sub-type.usecase';
import makeGetBalancesByTypeUsecase from '@app/ledger/usecases/reporting/balances-by-type/balances-by-type.usecase';

import buildBalanceSeriesHelper from './build-balance-series.helper';
import * as schemas from './dto';

const mockBalanceSeriesRepoQuery: jest.MockedFunction<TBalanceSeriesRepoQuery> =
  jest.fn();

describe('get-balance-series.usecase.spec', () => {
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
    repoQuery: mockBalanceSeriesRepoQuery,
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
      mockBalanceSeriesRepoQuery.mockResolvedValue([
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
        expect(mockBalanceSeriesRepoQuery).toHaveBeenCalledWith(
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
        expect(mockBalanceSeriesRepoQuery).not.toHaveBeenCalled();
      });
      it('rejects reversed and excessive ranges before storage', async () => {
        await expect(usecase({ ...query, to: '2025-12-31' })).rejects.toThrow(
          reportingError.InvalidPeriod
        );
        await expect(
          usecase({ ...query, from: '2024-01-01', to: '2025-01-01' })
        ).rejects.toThrow(reportingError.ReportPeriodLimitExceeded);
        expect(mockBalanceSeriesRepoQuery).not.toHaveBeenCalled();
      });
      it('propagates a failed read without a partial report', async () => {
        const failure = new Error('read failed');
        mockBalanceSeriesRepoQuery.mockRejectedValue(failure);
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
        expect(mockBalanceSeriesRepoQuery).toHaveBeenCalledWith(
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
        expect(mockBalanceSeriesRepoQuery).not.toHaveBeenCalled();
      });
      it('rejects reversed and excessive ranges before storage', async () => {
        await expect(usecase({ ...query, to: '2025-12-31' })).rejects.toThrow(
          reportingError.InvalidPeriod
        );
        await expect(
          usecase({ ...query, from: '2024-01-01', to: '2025-01-01' })
        ).rejects.toThrow(reportingError.ReportPeriodLimitExceeded);
        expect(mockBalanceSeriesRepoQuery).not.toHaveBeenCalled();
      });
      it('propagates a failed read without a partial report', async () => {
        const failure = new Error('read failed');
        mockBalanceSeriesRepoQuery.mockRejectedValue(failure);
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
        expect(mockBalanceSeriesRepoQuery).toHaveBeenCalledWith(
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
        expect(mockBalanceSeriesRepoQuery).not.toHaveBeenCalled();
      });
      it('rejects reversed and excessive ranges before storage', async () => {
        await expect(usecase({ ...query, to: '2025-12-31' })).rejects.toThrow(
          reportingError.InvalidPeriod
        );
        await expect(
          usecase({ ...query, from: '2024-01-01', to: '2025-01-01' })
        ).rejects.toThrow(reportingError.ReportPeriodLimitExceeded);
        expect(mockBalanceSeriesRepoQuery).not.toHaveBeenCalled();
      });
      it('propagates a failed read without a partial report', async () => {
        const failure = new Error('read failed');
        mockBalanceSeriesRepoQuery.mockRejectedValue(failure);
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
        expect(mockBalanceSeriesRepoQuery).toHaveBeenCalledWith(
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
        expect(mockBalanceSeriesRepoQuery).not.toHaveBeenCalled();
      });
      it('rejects reversed and excessive ranges before storage', async () => {
        await expect(usecase({ ...query, to: '2025-12-31' })).rejects.toThrow(
          reportingError.InvalidPeriod
        );
        await expect(
          usecase({ ...query, from: '2024-01-01', to: '2025-01-01' })
        ).rejects.toThrow(reportingError.ReportPeriodLimitExceeded);
        expect(mockBalanceSeriesRepoQuery).not.toHaveBeenCalled();
      });
      it('propagates a failed read without a partial report', async () => {
        const failure = new Error('read failed');
        mockBalanceSeriesRepoQuery.mockRejectedValue(failure);
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
        expect(mockBalanceSeriesRepoQuery).not.toHaveBeenCalled();
      });
      it('accepts control accounts and preserves overlapping parent and child requests', async () => {
        mockLedgerAccountRepo.findById
          .mockResolvedValueOnce({ ...account, isControlAccount: true })
          .mockResolvedValueOnce({ ...account, id: entityId });
        mockBalanceSeriesRepoQuery.mockResolvedValue([
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
        expect(mockBalanceSeriesRepoQuery).toHaveBeenCalledWith(
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
        expect(mockBalanceSeriesRepoQuery).not.toHaveBeenCalled();
      });
    });
  });
});

describe('balance-series.dto.validation.test', () => {
  const period = { from: '2026-01-01', to: '2026-01-31', bucketDays: 7 };

  describe('balance series query validation', () => {
    describe('types', () => {
      const schema = schemas.getBalancesByTypeQueryValidationSchema;
      it('accepts the specific filter', () => {
        expect(schema.safeParse({ ...period, types: ['asset'] }).success).toBe(
          true
        );
      });
      it.each([undefined, [], ['invalid'], 'asset'])(
        'rejects malformed filters %j',
        (filter) => {
          expect(schema.safeParse({ ...period, types: filter }).success).toBe(
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
          schema.safeParse({ ...period, types: ['asset'], ...invalid }).success
        ).toBe(false);
      });
    });
    describe('subTypes', () => {
      const schema = schemas.getBalancesBySubTypeQueryValidationSchema;
      it('accepts the specific filter', () => {
        expect(
          schema.safeParse({ ...period, subTypes: ['suspense'] }).success
        ).toBe(true);
      });
      it.each([undefined, [], ['invalid'], 'suspense'])(
        'rejects malformed filters %j',
        (filter) => {
          expect(
            schema.safeParse({ ...period, subTypes: filter }).success
          ).toBe(false);
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
          schema.safeParse({ ...period, subTypes: ['suspense'], ...invalid })
            .success
        ).toBe(false);
      });
    });
    describe('behaviors', () => {
      const schema = schemas.getBalancesByBehaviorQueryValidationSchema;
      it('accepts the specific filter', () => {
        expect(
          schema.safeParse({ ...period, behaviors: ['bank'] }).success
        ).toBe(true);
      });
      it.each([undefined, [], ['some_behavior'], 'bank'])(
        'rejects malformed filters %j',
        (filter) => {
          expect(
            schema.safeParse({ ...period, behaviors: filter }).success
          ).toBe(false);
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
          schema.safeParse({ ...period, behaviors: ['bank'], ...invalid })
            .success
        ).toBe(false);
      });
    });
    describe('accountIds', () => {
      const schema = schemas.getBalancesByAccountQueryValidationSchema;
      it('accepts the specific filter', () => {
        expect(
          schema.safeParse({
            ...period,
            accountIds: ['123e4567-e89b-12d3-a456-426614174001'],
          }).success
        ).toBe(true);
      });
      it.each([
        undefined,
        [],
        ['invalid'],
        '123e4567-e89b-12d3-a456-426614174001',
      ])('rejects malformed filters %j', (filter) => {
        expect(
          schema.safeParse({ ...period, accountIds: filter }).success
        ).toBe(false);
      });
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
  });
});

describe('build-balance-series.helper.spec', () => {
  const period = { from: new Date('2026-01-01'), to: new Date('2026-01-10') };
  // Each row is already the selected hierarchy root's subtree aggregate.
  const root: IBalanceSeriesRepoQueryOutput = {
    accountId: 'root',
    type: 'asset',
    subType: 'cash_and_cash_equivalent',
    behavior: 'bank',
    normalBalance: 'debit',
    bucketIndex: -1,
    debits: 1000n,
    credits: 200n,
  };

  describe('buildBalanceSeriesHelper', () => {
    it('carries root opening history across gaps and clips the final date', () => {
      const report = buildBalanceSeriesHelper(
        period,
        4,
        [
          { ...root, bucketIndex: 2, debits: 0n, credits: 900n },
          root,
          { ...root, bucketIndex: 0, debits: 50n, credits: 0n },
        ],
        SYSTEM_CURRENCIES.NGN,
        'account'
      );
      expect(report.period).toEqual({ from: '2026-01-01', to: '2026-01-10' });
      expect(
        report.buckets.map((bucket) => [
          bucket.date,
          bucket.balances[0].closingBalance.amount,
        ])
      ).toEqual([
        ['2026-01-04', 850],
        ['2026-01-08', 850],
        ['2026-01-10', -50],
      ]);
    });

    it('combines disjoint topmost roots of the same type', () => {
      const report = buildBalanceSeriesHelper(
        period,
        20,
        [
          root,
          {
            ...root,
            accountId: 'receivables-header',
            subType: 'receivables',
            behavior: 'default_receivables',
            debits: 300n,
            credits: 50n,
          },
        ],
        SYSTEM_CURRENCIES.NGN,
        'type'
      );
      expect(report.buckets[0].balances).toEqual([
        {
          type: 'asset',
          closingBalance: {
            amount: 1050,
            currencyCode: 'NGN',
            isMinorUnit: true,
          },
        },
      ]);
    });

    it('uses the selected root normal balance for every grouping, including contra controls', () => {
      const rows = [
        {
          ...root,
          normalBalance: 'credit' as const,
          debits: 0n,
          credits: 100n,
        },
      ];
      const reports = [
        buildBalanceSeriesHelper(
          period,
          4,
          rows,
          SYSTEM_CURRENCIES.NGN,
          'account'
        ),
        buildBalanceSeriesHelper(
          period,
          4,
          rows,
          SYSTEM_CURRENCIES.NGN,
          'type'
        ),
        buildBalanceSeriesHelper(
          period,
          4,
          rows,
          SYSTEM_CURRENCIES.NGN,
          'subType'
        ),
        buildBalanceSeriesHelper(
          period,
          4,
          rows,
          SYSTEM_CURRENCIES.NGN,
          'behavior'
        ),
      ];
      for (const report of reports) {
        expect(report.buckets[0].balances[0].closingBalance.amount).toBe(100);
      }
    });

    it('preserves parent identity for roots with reused classifications', () => {
      const rows = [
        { ...root, subType: 'suspense', behavior: 'default' },
        {
          ...root,
          accountId: 'liability-root',
          type: 'liability' as const,
          normalBalance: 'credit' as const,
          subType: 'suspense',
          behavior: 'default',
          debits: 0n,
          credits: 300n,
        },
      ];
      const reports = [
        buildBalanceSeriesHelper(
          period,
          20,
          rows,
          SYSTEM_CURRENCIES.NGN,
          'subType'
        ),
        buildBalanceSeriesHelper(
          period,
          20,
          rows,
          SYSTEM_CURRENCIES.NGN,
          'behavior'
        ),
      ];
      for (const report of reports) {
        expect(
          report.buckets[0].balances.map((balance) => [
            balance.type,
            balance.subType,
            balance.closingBalance.amount,
          ])
        ).toEqual([
          ['asset', 'suspense', 800],
          ['liability', 'suspense', 300],
        ]);
      }
    });

    it('combines same-bucket amounts from disjoint roots of a behavior', () => {
      const report = buildBalanceSeriesHelper(
        period,
        20,
        [
          { ...root, bucketIndex: 0 },
          { ...root, bucketIndex: 0, accountId: 'second-bank-root' },
        ],
        SYSTEM_CURRENCIES.NGN,
        'behavior'
      );
      expect(report.buckets[0].balances[0].closingBalance.amount).toBe(1600);
    });

    it('keeps a selected root with no activity at zero', () => {
      const report = buildBalanceSeriesHelper(
        period,
        4,
        [{ ...root, debits: 0n, credits: 0n }],
        SYSTEM_CURRENCIES.NGN,
        'behavior'
      );
      expect(
        report.buckets.map((bucket) => bucket.balances[0].closingBalance.amount)
      ).toEqual([0, 0, 0]);
    });

    it('does not invent roots when the chart has no matching accounts', () => {
      const reports = [
        buildBalanceSeriesHelper(period, 4, [], SYSTEM_CURRENCIES.NGN, 'type'),
        buildBalanceSeriesHelper(
          period,
          4,
          [],
          SYSTEM_CURRENCIES.NGN,
          'subType'
        ),
        buildBalanceSeriesHelper(
          period,
          4,
          [],
          SYSTEM_CURRENCIES.NGN,
          'behavior'
        ),
      ];
      for (const report of reports) {
        expect(report.buckets.map((bucket) => bucket.balances)).toEqual([
          [],
          [],
          [],
        ]);
      }
    });

    it('handles leap days and buckets larger than a one-day period', () => {
      const leapPeriod = {
        from: new Date('2024-02-28'),
        to: new Date('2024-03-01'),
      };
      expect(
        buildBalanceSeriesHelper(
          leapPeriod,
          2,
          [root],
          SYSTEM_CURRENCIES.NGN,
          'account'
        ).buckets.map((bucket) => bucket.date)
      ).toEqual(['2024-02-29', '2024-03-01']);
      expect(
        buildBalanceSeriesHelper(
          { from: period.from, to: period.from },
          Number.MAX_SAFE_INTEGER,
          [root],
          SYSTEM_CURRENCIES.NGN,
          'account'
        ).buckets
      ).toHaveLength(1);
    });

    it.each([100_000_000_000_001n, -100_000_000_000_001n])(
      'rejects excessive closing magnitudes %s',
      (amount) => {
        expect(() =>
          buildBalanceSeriesHelper(
            period,
            4,
            [{ ...root, debits: amount, credits: 0n }],
            SYSTEM_CURRENCIES.NGN,
            'account'
          )
        ).toThrow(reportingError.ReportAmountLimitExceeded);
      }
    );

    it('keeps raw aggregates exact until serialization of their net balance', () => {
      const report = buildBalanceSeriesHelper(
        period,
        4,
        [{ ...root, debits: 9007199254740993n, credits: 9007199254740992n }],
        SYSTEM_CURRENCIES.NGN,
        'account'
      );
      expect(report.buckets[0].balances[0]).toEqual({
        accountId: root.accountId,
        closingBalance: { amount: 1, currencyCode: 'NGN', isMinorUnit: true },
      });
    });

    it('rejects unsafe numeric serialization', () => {
      expect(() =>
        buildBalanceSeriesHelper(
          period,
          4,
          [{ ...root, debits: 9007199254740993n, credits: 0n }],
          { ...SYSTEM_CURRENCIES.NGN, minorUnit: 4 },
          'account'
        )
      ).toThrow(reportingError.AmountOutOfRange);
    });
  });
});
