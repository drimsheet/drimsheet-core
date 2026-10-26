import { TEntityId } from '@shared/types/uuid';

import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';

import { mockFiscalYearRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import accountingAppError from '@app/accounting/errors/accounting.error';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import reportingError from '@app/ledger/errors/reporting.error';

import makeGetLedgerTotalDebitsAndCreditsByCurrencyUsecase, {
  TGetLedgerTotalDebitsAndCreditsByCurrencyRepoQuery,
} from './ledger-total-debits-and-credits-by-currency.usecase';

const entityId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const year: IFiscalYear = {
  id: '123e4567-e89b-12d3-a456-426614174002' as TEntityId,
  createdBy: entityId,
  accountingEntityId: entityId,
  name: '2026/27',
  startDate: new Date('2026-04-01'),
  endDate: new Date('2027-03-31'),
  status: 'open',
  closedAt: null,
  updatedAt: new Date('2026-04-01'),
};
const repoQuery: jest.MockedFunction<TGetLedgerTotalDebitsAndCreditsByCurrencyRepoQuery> =
  jest.fn();
const execute = makeGetLedgerTotalDebitsAndCreditsByCurrencyUsecase({
  appContext: mockAppContext,
  fiscalYearRepo: mockFiscalYearRepo,
  repoQuery,
});
const query = { fiscalYearId: year.id, type: 'revenue' as const };

describe('ledger-total-debits-and-credits-by-currency', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-10-26T23:59:59Z'));
    mockAppContext.get.mockReturnValue({
      accountingEntity: { id: entityId },
      correlationId: 'totals',
    });
    mockFiscalYearRepo.findById.mockResolvedValue(year);
    repoQuery.mockResolvedValue([]);
  });
  afterEach(() => jest.useRealTimers());

  it.each(['asset', 'liability', 'revenue', 'expense'] as const)(
    'supports %s and scopes the fiscal year and query to the current entity',
    async (type) => {
      await expect(execute({ ...query, type })).resolves.toEqual({
        fiscalYearId: year.id,
        period: { from: '2026-04-01', to: '2026-10-26' },
        totalsByCurrency: [],
      });
      expect(mockFiscalYearRepo.findById).toHaveBeenCalledWith(
        entityId,
        year.id,
        { correlationId: 'totals' }
      );
      expect(repoQuery).toHaveBeenCalledWith(
        {
          accountingEntityId: entityId,
          type,
          period: { from: year.startDate, to: new Date('2026-10-26') },
        },
        { correlationId: 'totals' }
      );
    }
  );

  it('defaults historical years to the year end', async () => {
    jest.setSystemTime(new Date('2028-01-01'));
    expect((await execute(query)).period).toEqual({
      from: '2026-04-01',
      to: '2027-03-31',
    });
  });
  it.each([
    {
      startDate: '2026-04-01',
      endDate: '2027-03-31',
      from: '2026-04-01',
      to: '2027-03-31',
    },
    {
      startDate: '2026-07-01',
      endDate: '2026-09-30',
      from: '2026-07-01',
      to: '2026-09-30',
    },
    { startDate: '2026-07-01', from: '2026-07-01', to: '2026-10-26' },
    { endDate: '2026-07-01', from: '2026-04-01', to: '2026-07-01' },
    {
      startDate: '2026-07-01',
      endDate: '2026-07-01',
      from: '2026-07-01',
      to: '2026-07-01',
    },
  ])(
    'accepts inclusive boundaries and independently defaults omitted dates: %j',
    async ({ startDate, endDate, from, to }) => {
      expect((await execute({ ...query, startDate, endDate })).period).toEqual({
        from,
        to,
      });
    }
  );
  it.each([
    { startDate: '2026-03-31' },
    { endDate: '2027-04-01' },
    { startDate: '2026-09-01', endDate: '2026-08-31' },
    { endDate: '2026-03-31' },
    { startDate: '2027-04-01' },
  ])(
    'rejects invalid resolved periods before querying journals: %j',
    async (dates) => {
      await expect(execute({ ...query, ...dates })).rejects.toBeInstanceOf(
        reportingError.InvalidPeriod
      );
      expect(repoQuery).not.toHaveBeenCalled();
    }
  );
  it('requires explicit dates for a future year', async () => {
    jest.setSystemTime(new Date('2025-01-01'));
    await expect(execute(query)).rejects.toBeInstanceOf(
      reportingError.InvalidPeriod
    );
    expect(repoQuery).not.toHaveBeenCalled();
    await expect(
      execute({ ...query, startDate: '2026-04-01', endDate: '2026-04-30' })
    ).resolves.toMatchObject({
      period: { from: '2026-04-01', to: '2026-04-30' },
    });
  });
  it('returns separately validated original-currency totals in code order without netting', async () => {
    repoQuery.mockResolvedValue([
      { currencyCode: 'USD', debits: 7500n, credits: 44000n },
      { currencyCode: 'JPY', debits: 0n, credits: 20n },
    ]);
    expect((await execute(query)).totalsByCurrency).toEqual([
      {
        totalDebits: { amount: 0, currencyCode: 'JPY', isMinorUnit: true },
        totalCredits: { amount: 20, currencyCode: 'JPY', isMinorUnit: true },
      },
      {
        totalDebits: { amount: 7500, currencyCode: 'USD', isMinorUnit: true },
        totalCredits: { amount: 44000, currencyCode: 'USD', isMinorUnit: true },
      },
    ]);
  });
  it.each([
    { debits: -1n, credits: 0n },
    { debits: 0n, credits: -1n },
  ])('rejects negative aggregates %j', async (amounts) => {
    repoQuery.mockResolvedValue([{ currencyCode: 'USD', ...amounts }]);
    await expect(execute(query)).rejects.toBeInstanceOf(
      reportingError.AmountOutOfRange
    );
  });
  it.each([
    { debits: 100000000000001n, credits: 0n },
    { debits: 0n, credits: 100000000000001n },
  ])('checks each total against the report ceiling %j', async (amounts) => {
    repoQuery.mockResolvedValue([{ currencyCode: 'USD', ...amounts }]);
    await expect(execute(query)).rejects.toBeInstanceOf(
      reportingError.ReportAmountLimitExceeded
    );
  });
  it('rejects a fiscal year not found within this entity', async () => {
    mockFiscalYearRepo.findById.mockResolvedValue(null);
    await expect(execute(query)).rejects.toBeInstanceOf(
      accountingAppError.FiscalYearNotFound
    );
    expect(repoQuery).not.toHaveBeenCalled();
  });
  it.each([
    { fiscalYearId: '' },
    { fiscalYearId: 'invalid' },
    { type: 'invalid' },
    { type: 'equity' },
    { startDate: '2026-02-30' },
    { endDate: '0000-01-01' },
  ])('validates input before repository reads: %j', async (invalid) => {
    await expect(
      execute({ ...query, ...invalid } as Parameters<typeof execute>[0])
    ).rejects.toMatchObject({ errorKey: 'app_error_validation_error' });
    expect(mockFiscalYearRepo.findById).not.toHaveBeenCalled();
    expect(repoQuery).not.toHaveBeenCalled();
  });
  it('propagates fiscal year and aggregate read failures', async () => {
    const failure = new Error('storage failure');
    mockFiscalYearRepo.findById.mockRejectedValueOnce(failure);
    await expect(execute(query)).rejects.toBe(failure);
    expect(repoQuery).not.toHaveBeenCalled();
    repoQuery.mockRejectedValueOnce(failure);
    await expect(execute(query)).rejects.toBe(failure);
  });
});
