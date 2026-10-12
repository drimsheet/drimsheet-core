import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

import mockAppContext, {
  mockClientSession,
} from '@app/context/contracts/__mocks__/app-context.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import mockAccountCashFlowQueryRepo from '@app/reporting/contracts/__mocks__/account-cash-flow.query.repo.mock';
import reportingError from '@app/reporting/errors/reporting.error';
import makeGetAccountCashFlowUsecase from '@app/reporting/usecases/get-account-cash-flow.usecase';

const accountId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const query = { from: '2026-10-01', to: '2026-10-12', bucketDays: 4 };
const account = {
  id: accountId,
  accountingEntityId: entityId,
  type: 'asset',
  subType: 'cash_and_cash_equivalent',
  behavior: 'bank',
  isControlAccount: false,
  normalBalance: 'debit',
  status: 'active',
  currency: SYSTEM_CURRENCIES.NGN,
  meta: null,
  deletedAt: null,
} as ILedgerAccount;

describe('getAccountCashFlowUsecase', () => {
  const usecase = makeGetAccountCashFlowUsecase({
    appContext: mockAppContext,
    ledgerAccountRepo: mockLedgerAccountRepo,
    accountCashFlowQueryRepo: mockAccountCashFlowQueryRepo,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      accountingEntity: { id: entityId } as IAccountingEntity,
      correlationId: 'cash-flow-spec',
      idempotencyKey: '',
      clientSession: mockClientSession,
    });
    mockLedgerAccountRepo.findById.mockResolvedValue(account);
    mockAccountCashFlowQueryRepo.aggregateByAccount.mockResolvedValue([]);
  });

  it('scopes account and aggregate reads to the current entity and returns money DTOs', async () => {
    mockAccountCashFlowQueryRepo.aggregateByAccount.mockResolvedValue([
      { bucketIndex: 0, moneyIn: 100_00n, moneyOut: 20_00n },
    ]);
    const report = await usecase(accountId, query);
    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
      accountId,
      entityId,
      { correlationId: 'cash-flow-spec' }
    );
    expect(
      mockAccountCashFlowQueryRepo.aggregateByAccount
    ).toHaveBeenCalledWith(
      {
        accountId,
        accountingEntityId: entityId,
        currencyCode: 'NGN',
        ...query,
      },
      { correlationId: 'cash-flow-spec' }
    );
    expect(report).toEqual({
      accountId,
      currencyCode: 'NGN',
      period: { from: query.from, to: query.to },
      totalMoneyIn: { amount: 100_00, currencyCode: 'NGN', isMinorUnit: true },
      totalMoneyOut: { amount: 20_00, currencyCode: 'NGN', isMinorUnit: true },
      buckets: [
        {
          from: '2026-10-01',
          to: '2026-10-04',
          moneyIn: { amount: 100_00, currencyCode: 'NGN', isMinorUnit: true },
          moneyOut: { amount: 20_00, currencyCode: 'NGN', isMinorUnit: true },
        },
        {
          from: '2026-10-05',
          to: '2026-10-08',
          moneyIn: { amount: 0, currencyCode: 'NGN', isMinorUnit: true },
          moneyOut: { amount: 0, currencyCode: 'NGN', isMinorUnit: true },
        },
        {
          from: '2026-10-09',
          to: '2026-10-12',
          moneyIn: { amount: 0, currencyCode: 'NGN', isMinorUnit: true },
          moneyOut: { amount: 0, currencyCode: 'NGN', isMinorUnit: true },
        },
      ],
    });
  });

  it('returns zeros in the account currency for an empty period', async () => {
    mockLedgerAccountRepo.findById.mockResolvedValue({
      ...account,
      currency: SYSTEM_CURRENCIES.USD,
    });
    const report = await usecase(accountId, query);
    expect(report.currencyCode).toBe('USD');
    expect(report.totalMoneyIn.amount).toBe(0);
    expect(report.totalMoneyOut.amount).toBe(0);
    expect(report.buckets).toHaveLength(3);
  });

  it('rejects invalid inputs before any account read', async () => {
    await expect(usecase('invalid-id', query)).rejects.toThrow(
      reportingError.InvalidAccountId
    );
    await expect(
      usecase(accountId, { ...query, from: '2026-02-30' })
    ).rejects.toThrow(appError.UnprocessableEntity);
    await expect(
      usecase(accountId, { ...query, bucketDays: 0 })
    ).rejects.toThrow(appError.UnprocessableEntity);
    await expect(
      usecase(accountId, {
        from: '2024-01-01',
        to: '2025-01-01',
        bucketDays: 1,
      })
    ).rejects.toThrow(reportingError.ReportPeriodLimitExceeded);
    await expect(
      usecase(accountId, { ...query, to: '2026-09-30' })
    ).rejects.toThrow(reportingError.InvalidPeriod);
    expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
    expect(
      mockAccountCashFlowQueryRepo.aggregateByAccount
    ).not.toHaveBeenCalled();
  });

  it('rejects missing and foreign accounts before aggregation', async () => {
    mockLedgerAccountRepo.findById.mockResolvedValue(null);
    await expect(usecase(accountId, query)).rejects.toThrow(
      reportingError.AccountNotFound
    );
    expect(
      mockAccountCashFlowQueryRepo.aggregateByAccount
    ).not.toHaveBeenCalled();
  });

  it('rejects non-cash accounts before aggregation', async () => {
    mockLedgerAccountRepo.findById.mockResolvedValue({
      ...account,
      subType: 'receivables',
    });
    await expect(usecase(accountId, query)).rejects.toThrow(
      reportingError.UnsupportedAccount
    );
    expect(
      mockAccountCashFlowQueryRepo.aggregateByAccount
    ).not.toHaveBeenCalled();
  });

  it('propagates storage failures without returning a partial report', async () => {
    const failure = new Error('unavailable');
    mockAccountCashFlowQueryRepo.aggregateByAccount.mockRejectedValue(failure);
    await expect(usecase(accountId, query)).rejects.toBe(failure);
  });

  it('rejects totals above the product cap before number conversion', async () => {
    mockAccountCashFlowQueryRepo.aggregateByAccount.mockResolvedValue([
      { bucketIndex: 0, moneyIn: 100_000_000_000_001n, moneyOut: 0n },
    ]);
    await expect(usecase(accountId, query)).rejects.toThrow(
      reportingError.ReportAmountLimitExceeded
    );
  });

  describe('account eligibility', () => {
    it.each(['bank', 'petty_cash'])(
      'accepts an archived %s account with ordinary metadata',
      async (behavior) => {
        mockLedgerAccountRepo.findById.mockResolvedValue({
          ...account,
          behavior,
          status: 'archived',
          meta: { bankName: 'Bank' },
        });
        const report = await usecase(accountId, query);
        expect(report.currencyCode).toBe('NGN');
      }
    );

    it.each<Partial<ILedgerAccount>>([
      { type: 'liability' },
      { subType: 'receivables' },
      { behavior: 'default_cash' },
      { isControlAccount: true },
      { normalBalance: 'credit' },
      { status: 'draft' },
      { currency: null },
      { deletedAt: new Date() },
      { meta: { adjustmentType: 'contra', targetAccountId: account.id } },
      { meta: { adjustmentType: 'adjunct', targetAccountId: account.id } },
    ])(
      'rejects unsupported account attributes %j before aggregation',
      async (attributes) => {
        mockLedgerAccountRepo.findById.mockResolvedValue({
          ...account,
          ...attributes,
        });
        await expect(usecase(accountId, query)).rejects.toThrow(
          reportingError.UnsupportedAccount
        );
        expect(
          mockAccountCashFlowQueryRepo.aggregateByAccount
        ).not.toHaveBeenCalled();
      }
    );
  });

  describe('bucket assembly', () => {
    it('fills gaps, orders buckets and sums the chart fixture exactly', async () => {
      mockAccountCashFlowQueryRepo.aggregateByAccount.mockResolvedValue([
        { bucketIndex: 2, moneyIn: 900_000_00n, moneyOut: 530_000_00n },
        { bucketIndex: 0, moneyIn: 300_000_00n, moneyOut: 250_000_00n },
      ]);
      const report = await usecase(accountId, query);
      expect(
        report.buckets.map((bucket) => [
          bucket.from,
          bucket.to,
          bucket.moneyIn.amount,
          bucket.moneyOut.amount,
        ])
      ).toEqual([
        ['2026-10-01', '2026-10-04', 300_000_00, 250_000_00],
        ['2026-10-05', '2026-10-08', 0, 0],
        ['2026-10-09', '2026-10-12', 900_000_00, 530_000_00],
      ]);
      expect(report.totalMoneyIn.amount).toBe(1_200_000_00);
      expect(report.totalMoneyOut.amount).toBe(780_000_00);
    });

    it('returns zero buckets with a partial final bucket', async () => {
      const report = await usecase(accountId, { ...query, to: '2026-10-10' });
      expect(report.buckets.map((bucket) => bucket.to)).toEqual([
        '2026-10-04',
        '2026-10-08',
        '2026-10-10',
      ]);
      expect(report.totalMoneyIn.amount).toBe(0);
      expect(report.totalMoneyOut.amount).toBe(0);
    });

    it('handles leap days and a bucket larger than a period across years', async () => {
      const leapDayReport = await usecase(accountId, {
        from: '2024-02-28',
        to: '2024-03-01',
        bucketDays: 2,
      });
      expect(
        leapDayReport.buckets.map((bucket) => [bucket.from, bucket.to])
      ).toEqual([
        ['2024-02-28', '2024-02-29'],
        ['2024-03-01', '2024-03-01'],
      ]);
      const yearEndReport = await usecase(accountId, {
        from: '2025-12-31',
        to: '2026-01-01',
        bucketDays: Number.MAX_SAFE_INTEGER,
      });
      expect(
        yearEndReport.buckets.map((bucket) => [bucket.from, bucket.to])
      ).toEqual([['2025-12-31', '2026-01-01']]);
    });

    it('accepts a whole leap year and a single day', async () => {
      const annualReport = await usecase(accountId, {
        from: '2024-01-01',
        to: '2024-12-31',
        bucketDays: 1,
      });
      expect(annualReport.buckets).toHaveLength(366);
      const singleDayReport = await usecase(accountId, {
        ...query,
        to: query.from,
      });
      expect(
        singleDayReport.buckets.map((bucket) => [bucket.from, bucket.to])
      ).toEqual([[query.from, query.from]]);
    });
  });

  describe('amount limits', () => {
    it.each([
      SYSTEM_CURRENCIES.NGN,
      SYSTEM_CURRENCIES.USD,
      SYSTEM_CURRENCIES.JPY,
    ])('uses the major-unit ceiling at $code precision', async (currency) => {
      const cap = 1_000_000_000_000n * 10n ** BigInt(currency.minorUnit);
      mockLedgerAccountRepo.findById.mockResolvedValue({
        ...account,
        currency,
      });
      mockAccountCashFlowQueryRepo.aggregateByAccount.mockResolvedValue([
        { bucketIndex: 0, moneyIn: cap, moneyOut: cap },
      ]);
      const report = await usecase(accountId, query);
      expect(report.totalMoneyIn.amount).toBe(Number(cap));
      expect(report.totalMoneyOut.amount).toBe(Number(cap));
      for (const direction of ['moneyIn', 'moneyOut'] as const) {
        mockAccountCashFlowQueryRepo.aggregateByAccount.mockResolvedValue([
          {
            bucketIndex: 0,
            moneyIn: cap,
            moneyOut: cap,
            [direction]: cap + 1n,
          },
        ]);
        await expect(usecase(accountId, query)).rejects.toThrow(
          reportingError.ReportAmountLimitExceeded
        );
      }
    });

    it('checks gross period totals even when individual buckets fit and net movement is zero', async () => {
      mockAccountCashFlowQueryRepo.aggregateByAccount.mockResolvedValue([
        {
          bucketIndex: 0,
          moneyIn: 50_000_000_000_000n,
          moneyOut: 50_000_000_000_000n,
        },
        {
          bucketIndex: 1,
          moneyIn: 50_000_000_000_001n,
          moneyOut: 50_000_000_000_001n,
        },
      ]);
      await expect(usecase(accountId, query)).rejects.toThrow(
        reportingError.ReportAmountLimitExceeded
      );
    });

    it('retains the safe-integer guard when currency precision puts the cap above safe numbers', async () => {
      const currency = { ...SYSTEM_CURRENCIES.NGN, minorUnit: 4 };
      const safe = BigInt(Number.MAX_SAFE_INTEGER);
      mockLedgerAccountRepo.findById.mockResolvedValue({
        ...account,
        currency,
      });
      mockAccountCashFlowQueryRepo.aggregateByAccount.mockResolvedValue([
        { bucketIndex: 0, moneyIn: safe, moneyOut: safe },
      ]);
      const report = await usecase(accountId, query);
      expect(report.totalMoneyIn.amount).toBe(Number.MAX_SAFE_INTEGER);
      expect(report.totalMoneyOut.amount).toBe(Number.MAX_SAFE_INTEGER);
      for (const direction of ['moneyIn', 'moneyOut'] as const) {
        mockAccountCashFlowQueryRepo.aggregateByAccount.mockResolvedValue([
          { bucketIndex: 0, moneyIn: 0n, moneyOut: 0n, [direction]: safe + 1n },
        ]);
        await expect(usecase(accountId, query)).rejects.toThrow(
          reportingError.AmountOutOfRange
        );
      }
    });

    it('rejects negative totals and bucket values even when other buckets offset them', async () => {
      mockAccountCashFlowQueryRepo.aggregateByAccount.mockResolvedValue([
        { bucketIndex: 0, moneyIn: -1n, moneyOut: 0n },
      ]);
      await expect(usecase(accountId, query)).rejects.toThrow(
        reportingError.AmountOutOfRange
      );
      for (const direction of ['moneyIn', 'moneyOut'] as const) {
        mockAccountCashFlowQueryRepo.aggregateByAccount.mockResolvedValue([
          { bucketIndex: 0, moneyIn: 0n, moneyOut: 0n, [direction]: -1n },
          { bucketIndex: 1, moneyIn: 1n, moneyOut: 1n },
        ]);
        await expect(usecase(accountId, query)).rejects.toThrow(
          reportingError.AmountOutOfRange
        );
      }
    });
  });
});
