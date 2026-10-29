import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import currencyEntity from '@domain/money/entities/currency.entity';
import { ICurrency } from '@domain/money/types/currency.types';
import moneyValue from '@domain/money/values/money.vo';

import mockAppContext, {
  mockClientSession,
} from '@app/context/contracts/__mocks__/app-context.mock';
import reportingError from '@app/ledger/errors/reporting.error';

import { revenueAndExpenseActivitySummaryMapper } from './dto';
import type { TGetRevenueAndExpenseActivitySummaryRepoQuery } from './revenue-and-expense-activity-summary.usecase';
import makeGetRevenueAndExpenseActivitySummaryUsecase, {
  IGetRevenueAndExpenseActivitySummaryRepoQueryOutput,
} from './revenue-and-expense-activity-summary.usecase';

const mockRevenueAndExpenseActivitySummaryRepoQuery: jest.MockedFunction<TGetRevenueAndExpenseActivitySummaryRepoQuery> =
  jest.fn();

jest.mock('@domain/money/entities/currency.entity', () => {
  const actual = jest.requireActual<
    typeof import('@domain/money/entities/currency.entity')
  >('@domain/money/entities/currency.entity');
  return {
    __esModule: true,
    ...actual,
    default: { ...actual.default, getByCode: jest.fn() },
  };
});

describe('get-revenue-and-expense-activity-summary.usecase.spec', () => {
  const empty: IGetRevenueAndExpenseActivitySummaryRepoQueryOutput = {
    accounts: [],
    suspense: { transactionCount: 0n, amount: 0n },
  };
  type TAccount =
    IGetRevenueAndExpenseActivitySummaryRepoQueryOutput['accounts'][number];
  const account: TAccount = {
    accountId: 'revenue',
    accountName: 'Services',
    type: 'revenue',
    debits: 0n,
    credits: 112_00n,
    previousDebits: 0n,
    previousCredits: 100_00n,
  };

  const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const query = { from: '2026-10-01', to: '2026-10-14' };

  describe('getRevenueAndExpenseActivitySummaryUsecase', () => {
    const usecase = makeGetRevenueAndExpenseActivitySummaryUsecase({
      appContext: mockAppContext,
      repoQuery: mockRevenueAndExpenseActivitySummaryRepoQuery,
    });

    beforeEach(() => {
      jest.resetAllMocks();
      jest
        .mocked(currencyEntity.getByCode)
        .mockReturnValue(SYSTEM_CURRENCIES.NGN);
      mockAppContext.get.mockReturnValue({
        accountingEntity: {
          id: entityId,
          functionalCurrencyCode: 'NGN',
        } as IAccountingEntity,
        correlationId: 'summary-spec',
        idempotencyKey: '',
        clientSession: mockClientSession,
      });
      mockRevenueAndExpenseActivitySummaryRepoQuery.mockResolvedValue({
        accounts: [],
        suspense: { transactionCount: 0n, amount: 0n },
      });
    });

    it('scopes one aggregate read to the active entity, its currency and both periods', async () => {
      const response = await usecase(query);
      const queryInput =
        mockRevenueAndExpenseActivitySummaryRepoQuery.mock.calls[0][0];
      expect(Object.isFrozen(queryInput.period)).toBe(true);
      expect(Object.isFrozen(queryInput.comparisonPeriod)).toBe(true);
      expect(mockAppContext.get).toHaveBeenCalledWith(['accountingEntity']);
      expect(
        mockRevenueAndExpenseActivitySummaryRepoQuery
      ).toHaveBeenCalledTimes(1);
      expect(
        mockRevenueAndExpenseActivitySummaryRepoQuery
      ).toHaveBeenCalledWith(
        {
          accountingEntityId: entityId,
          currencyCode: 'NGN',
          period: { from: new Date(query.from), to: new Date(query.to) },
          comparisonPeriod: {
            from: new Date('2026-09-17'),
            to: new Date('2026-09-30'),
          },
        },
        { correlationId: 'summary-spec' }
      );
      expect(response.currencyCode).toBe('NGN');
      expect(response.revenue.total).toEqual({
        amount: 0,
        currencyCode: 'NGN',
        isMinorUnit: true,
      });
    });

    it.each([
      [query, { from: '2026-09-17', to: '2026-09-30' }],
      [
        { from: '2026-01-01', to: '2026-01-01' },
        { from: '2025-12-31', to: '2025-12-31' },
      ],
      [
        { from: '2024-03-01', to: '2024-03-02' },
        { from: '2024-02-28', to: '2024-02-29' },
      ],
      [
        { from: '2024-01-01', to: '2024-12-31' },
        { from: '2022-12-31', to: '2023-12-31' },
      ],
    ])(
      'derives and queries an adjacent equal-length comparison for %j',
      async (period, comparisonPeriod) => {
        const report = await usecase(period);
        expect(report.period).toEqual(period);
        expect(report.comparisonPeriod).toEqual(comparisonPeriod);
        expect(
          mockRevenueAndExpenseActivitySummaryRepoQuery
        ).toHaveBeenCalledWith(
          {
            accountingEntityId: entityId,
            currencyCode: 'NGN',
            period: { from: new Date(period.from), to: new Date(period.to) },
            comparisonPeriod: {
              from: new Date(comparisonPeriod.from),
              to: new Date(comparisonPeriod.to),
            },
          },
          { correlationId: 'summary-spec' }
        );
      }
    );

    it.each([
      [{ ...query, from: '2026-02-30' }, appError.UnprocessableEntity],
      [{ ...query, to: '2026-09-30' }, reportingError.InvalidPeriod],
      [{ from: '0001-01-01', to: '0001-01-01' }, reportingError.InvalidPeriod],
      [
        { from: '2024-01-01', to: '2025-01-01' },
        reportingError.ReportPeriodLimitExceeded,
      ],
    ])(
      'rejects invalid query %j before reading the database',
      async (invalid, ErrorClass) => {
        await expect(usecase(invalid)).rejects.toThrow(ErrorClass);
        expect(
          mockRevenueAndExpenseActivitySummaryRepoQuery
        ).not.toHaveBeenCalled();
      }
    );

    it('propagates storage failures without returning a partial overview', async () => {
      const failure = new Error('query unavailable');
      mockRevenueAndExpenseActivitySummaryRepoQuery.mockRejectedValue(failure);
      await expect(usecase(query)).rejects.toBe(failure);
    });

    it('calculates net amounts, both comparison directions and signed shares', async () => {
      const aggregates: IGetRevenueAndExpenseActivitySummaryRepoQueryOutput = {
        accounts: [
          {
            ...account,
            accountId: 'returns',
            credits: 0n,
            debits: 20_00n,
            previousCredits: 0n,
          },
          { ...account, credits: 132_00n },
          {
            ...account,
            accountId: 'rent',
            type: 'expense',
            debits: 100_00n,
            credits: 4_00n,
            previousDebits: 100_00n,
            previousCredits: 0n,
          },
        ],
        suspense: { transactionCount: 12n, amount: 450_000_00n },
      };
      const report = await getReport(aggregates, SYSTEM_CURRENCIES.NGN);
      expect(report.revenue.total.amount).toBe(112_00);
      expect(report.revenue.previousTotal.amount).toBe(100_00);
      expect(report.revenue.percentageChange).toBe(12);
      expect(
        report.revenue.accounts.map((item) => [
          item.accountId,
          item.sharePercentage,
        ])
      ).toEqual([
        ['revenue', 117.86],
        ['returns', -17.86],
      ]);
      expect(report.expenses.total.amount).toBe(96_00);
      expect(report.expenses.percentageChange).toBe(-4);
      expect(report.suspense).toEqual({
        transactionCount: 12,
        amount: { amount: 450_000_00, currencyCode: 'NGN', isMinorUnit: true },
      });
    });

    it('returns zero totals, empty breakdowns and null comparisons without activity', async () => {
      const report = await getReport(empty, SYSTEM_CURRENCIES.USD);
      expect(report.revenue).toEqual({
        total: { amount: 0, currencyCode: 'USD', isMinorUnit: true },
        previousTotal: { amount: 0, currencyCode: 'USD', isMinorUnit: true },
        percentageChange: null,
        accounts: [],
      });
      expect(report.expenses).toEqual(report.revenue);
      expect(report.suspense.transactionCount).toBe(0);
    });

    it('retains previous-only accounts in comparisons but omits zero current amounts', async () => {
      const report = await getReport(
        {
          ...empty,
          accounts: [{ ...account, credits: 0n }],
        },
        SYSTEM_CURRENCIES.NGN
      );
      expect(report.revenue.accounts).toEqual([]);
      expect(report.revenue.previousTotal.amount).toBe(100_00);
      expect(report.revenue.percentageChange).toBe(-100);
    });

    it('returns null shares when opposite account movements cancel the total', async () => {
      const report = await getReport(
        {
          ...empty,
          accounts: [
            account,
            { ...account, accountId: 'refund', credits: 0n, debits: 112_00n },
          ],
        },
        SYSTEM_CURRENCIES.NGN
      );
      expect(report.revenue.total.amount).toBe(0);
      expect(
        report.revenue.accounts.map((item) => item.sharePercentage)
      ).toEqual([null, null]);
    });

    it('handles negative totals and compares against the magnitude of a negative previous total', async () => {
      const report = await getReport(
        {
          ...empty,
          accounts: [
            {
              ...account,
              credits: 0n,
              debits: 50_00n,
              previousCredits: 0n,
              previousDebits: 100_00n,
            },
          ],
        },
        SYSTEM_CURRENCIES.NGN
      );
      expect(report.revenue.total.amount).toBe(-50_00);
      expect(report.revenue.percentageChange).toBe(50);
      expect(report.revenue.accounts[0].sharePercentage).toBe(100);
    });

    it('sorts by descending amount and account ID on ties, independently of query order', async () => {
      const report = await getReport(
        {
          ...empty,
          accounts: [
            { ...account, accountId: 'c', credits: 1n },
            { ...account, accountId: 'b', credits: 2n },
            { ...account, accountId: 'a', credits: 2n },
          ],
        },
        SYSTEM_CURRENCIES.NGN
      );
      expect(report.revenue.accounts.map((item) => item.accountId)).toEqual([
        'a',
        'b',
        'c',
      ]);
    });

    it.each(['NGN', 'JPY'] as const)(
      'applies the amount ceiling at %s precision',
      async (code) => {
        const currency = SYSTEM_CURRENCIES[code];
        const cap = 1_000_000_000_000n * 10n ** BigInt(currency.minorUnit);
        const aggregates = {
          ...empty,
          accounts: [{ ...account, credits: cap }],
        };
        expect(
          (await getReport(aggregates, currency)).revenue.total.amount
        ).toBe(Number(cap));
        for (const credits of [cap + 1n, -cap - 1n]) {
          await expect(
            getReport(
              {
                ...empty,
                accounts: [{ ...account, credits }],
              },
              currency
            )
          ).rejects.toThrow(reportingError.ReportAmountLimitExceeded);
        }
      }
    );

    it('rejects a total above the ceiling even when individual accounts fit', async () => {
      await expect(
        getReport(
          {
            ...empty,
            accounts: [
              { ...account, credits: 100_000_000_000_000n },
              { ...account, accountId: 'other', credits: 1n },
            ],
          },
          SYSTEM_CURRENCIES.NGN
        )
      ).rejects.toThrow(reportingError.ReportAmountLimitExceeded);
    });

    it('rejects unsafe minor units before DTO conversion', async () => {
      await expect(
        getReport(
          {
            ...empty,
            accounts: [{ ...account, credits: 9007199254740993n }],
          },
          { ...SYSTEM_CURRENCIES.NGN, minorUnit: 4 }
        )
      ).rejects.toThrow(reportingError.AmountOutOfRange);
    });

    it.each([
      { transactionCount: 9007199254740993n, amount: 0n },
      { transactionCount: -1n, amount: 0n },
      { transactionCount: 1n, amount: -1n },
    ])('rejects invalid suspense aggregates %p', async (suspense) => {
      await expect(
        getReport(
          {
            ...empty,
            suspense,
          },
          SYSTEM_CURRENCIES.NGN
        )
      ).rejects.toThrow(reportingError.AmountOutOfRange);
    });

    async function getReport(
      aggregates: IGetRevenueAndExpenseActivitySummaryRepoQueryOutput,
      currency: ICurrency
    ) {
      jest.mocked(currencyEntity.getByCode).mockReturnValue(currency);
      mockRevenueAndExpenseActivitySummaryRepoQuery.mockResolvedValue(
        aggregates
      );
      return usecase(query);
    }
  });
});

describe('revenue-and-expense-activity-summary.dto.mapper.test', () => {
  describe('revenueAndExpenseActivitySummaryMapper', () => {
    it('maps every overview field to JSON-safe money DTOs without mutating the report', () => {
      const money = moneyValue.make(123_45n, SYSTEM_CURRENCIES.NGN, true);
      const section = {
        total: money,
        previousTotal: money,
        percentageChange: 0,
        accounts: [
          {
            accountId: 'account',
            accountName: 'Services',
            amount: money,
            sharePercentage: 100,
          },
        ],
      };
      const report = {
        period: { from: new Date('2026-10-01'), to: new Date('2026-10-14') },
        comparisonPeriod: {
          from: new Date('2026-09-17'),
          to: new Date('2026-09-30'),
        },
        revenue: section,
        expenses: section,
        suspense: { transactionCount: 2, amount: money },
      };
      const dtoMoney = {
        amount: 12345,
        currencyCode: 'NGN',
        isMinorUnit: true,
      };
      const dtoSection = {
        total: dtoMoney,
        previousTotal: dtoMoney,
        percentageChange: 0,
        accounts: [
          {
            accountId: 'account',
            accountName: 'Services',
            amount: dtoMoney,
            sharePercentage: 100,
          },
        ],
      };
      const dto = revenueAndExpenseActivitySummaryMapper.toDto(report);
      expect(dto).toEqual({
        currencyCode: 'NGN',
        period: { from: '2026-10-01', to: '2026-10-14' },
        comparisonPeriod: { from: '2026-09-17', to: '2026-09-30' },
        revenue: dtoSection,
        expenses: dtoSection,
        suspense: { transactionCount: 2, amount: dtoMoney },
      });
      expect(() => JSON.stringify(dto)).not.toThrow();
      expect(report.revenue.total.amount).toBe(123_45n);
    });
  });
});
