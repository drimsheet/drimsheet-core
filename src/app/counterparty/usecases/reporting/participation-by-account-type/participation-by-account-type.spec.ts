import { TEntityId } from '@shared/types/uuid';

import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';
import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import { ICounterparty } from '@domain/counterparty/types/counterparty.types';

import { mockFiscalYearRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import accountingAppError from '@app/accounting/errors/accounting.error';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { mockCounterpartyRepo } from '@app/counterparty/contracts/__mocks__/counterparty.repos.mock';
import reportingError from '@app/ledger/errors/reporting.error';

import counterpartyReportingError from './error';
import makeGetCounterpartyAccountTypeParticipationUsecase, {
  TGetCounterpartyAccountTypeParticipationRepoQuery,
} from './participation-by-account-type.usecase';

const entityId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const counterpartyId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const year: IFiscalYear = {
  id: '123e4567-e89b-12d3-a456-426614174003' as TEntityId,
  createdBy: entityId,
  accountingEntityId: entityId,
  name: '2026/27',
  startDate: new Date('2026-04-01'),
  endDate: new Date('2027-03-31'),
  status: 'open',
  closedAt: null,
  updatedAt: new Date('2026-04-01'),
};
const repoQuery: jest.MockedFunction<TGetCounterpartyAccountTypeParticipationRepoQuery> =
  jest.fn();
const execute = makeGetCounterpartyAccountTypeParticipationUsecase({
  appContext: mockAppContext,
  counterpartyRepo: mockCounterpartyRepo,
  fiscalYearRepo: mockFiscalYearRepo,
  repoQuery,
});
const query = { fiscalYearId: year.id };
const moneyDto = (amount: number) => ({
  amount,
  currencyCode: 'NGN',
  isMinorUnit: true,
});

describe('participation-by-account-type', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      accountingEntity: { id: entityId, functionalCurrencyCode: 'NGN' },
      correlationId: 'participation',
    });
    mockCounterpartyRepo.findById.mockResolvedValue({
      id: counterpartyId,
      status: 'archived',
    } as ICounterparty);
    mockFiscalYearRepo.findById.mockResolvedValue(year);
    repoQuery.mockResolvedValue([]);
  });

  it('scopes both lookups and the full-year aggregate to the entity, returning zero without activity', async () => {
    await expect(execute(counterpartyId, query)).resolves.toEqual({
      counterpartyId,
      fiscalYearId: year.id,
      period: { from: '2026-04-01', to: '2027-03-31' },
      revenue: moneyDto(0),
      expense: moneyDto(0),
    });
    const options = { correlationId: 'participation' };
    expect(mockCounterpartyRepo.findById).toHaveBeenCalledWith(
      counterpartyId,
      entityId,
      options
    );
    expect(mockFiscalYearRepo.findById).toHaveBeenCalledWith(
      entityId,
      year.id,
      options
    );
    expect(repoQuery).toHaveBeenCalledWith(
      {
        accountingEntityId: entityId,
        counterpartyId,
        currencyCode: 'NGN',
        period: { from: year.startDate, to: year.endDate },
      },
      options
    );
    expect(repoQuery).toHaveBeenCalledTimes(1);
  });

  it('nets each class on its normal side and preserves negative participation', async () => {
    repoQuery.mockResolvedValue([
      { type: 'revenue', debits: 200n, credits: 1000n },
      { type: 'expense', debits: 100n, credits: 500n },
    ]);
    expect(await execute(counterpartyId, query)).toMatchObject({
      revenue: moneyDto(800),
      expense: moneyDto(-400),
    });
  });

  it.each(['revenue', 'expense'] as const)(
    'cancels equal debit and credit effects for %s',
    async (type) => {
      repoQuery.mockResolvedValue([{ type, debits: 900n, credits: 900n }]);
      expect((await execute(counterpartyId, query))[type]).toEqual(moneyDto(0));
    }
  );

  it('keeps exact arithmetic until serialization even when gross totals exceed safe integers', async () => {
    repoQuery.mockResolvedValue([
      {
        type: 'revenue',
        debits: 9007199254740992n,
        credits: 9007199254740993n,
      },
    ]);
    expect((await execute(counterpartyId, query)).revenue).toEqual(moneyDto(1));
  });

  it.each([100000000000001n, -100000000000001n])(
    'rejects excessive net amounts: %s',
    async (net) => {
      repoQuery.mockResolvedValue([
        {
          type: 'revenue',
          debits: net < 0n ? -net : 0n,
          credits: net > 0n ? net : 0n,
        },
      ]);
      await expect(execute(counterpartyId, query)).rejects.toBeInstanceOf(
        reportingError.ReportAmountLimitExceeded
      );
    }
  );

  it('rejects a missing or foreign counterparty before reading the fiscal year', async () => {
    mockCounterpartyRepo.findById.mockResolvedValue(null);
    await expect(execute(counterpartyId, query)).rejects.toBeInstanceOf(
      counterpartyReportingError.CounterpartyNotFound
    );
    expect(mockFiscalYearRepo.findById).not.toHaveBeenCalled();
    expect(repoQuery).not.toHaveBeenCalled();
  });

  it('rejects a missing or foreign fiscal year before aggregation', async () => {
    mockFiscalYearRepo.findById.mockResolvedValue(null);
    await expect(execute(counterpartyId, query)).rejects.toBeInstanceOf(
      accountingAppError.FiscalYearNotFound
    );
    expect(repoQuery).not.toHaveBeenCalled();
  });

  it('rejects a malformed counterparty ID before reading storage', async () => {
    await expect(execute('bad-id', query)).rejects.toBeInstanceOf(
      counterpartyError.InvalidCounterpartyId
    );
    expect(mockCounterpartyRepo.findById).not.toHaveBeenCalled();
    expect(repoQuery).not.toHaveBeenCalled();
  });

  it.each(['', 'bad-id', undefined])(
    'rejects an invalid fiscal-year ID: %s',
    async (fiscalYearId) => {
      await expect(
        execute(counterpartyId, { fiscalYearId } as typeof query)
      ).rejects.toMatchObject({ errorKey: 'app_error_validation_error' });
      expect(mockCounterpartyRepo.findById).not.toHaveBeenCalled();
      expect(repoQuery).not.toHaveBeenCalled();
    }
  );

  it('preserves report dates when a query attempts to mutate its period', async () => {
    repoQuery.mockImplementationOnce(async (criteria) => {
      criteria.period.from.setUTCFullYear(2030);
      criteria.period.to.setTime(NaN);
      return [];
    });
    expect((await execute(counterpartyId, query)).period).toEqual({
      from: '2026-04-01',
      to: '2027-03-31',
    });
    expect(year.startDate.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('propagates each read failure', async () => {
    const failure = new Error('storage failure');
    mockCounterpartyRepo.findById.mockRejectedValueOnce(failure);
    await expect(execute(counterpartyId, query)).rejects.toBe(failure);
    expect(mockFiscalYearRepo.findById).not.toHaveBeenCalled();
    mockFiscalYearRepo.findById.mockRejectedValueOnce(failure);
    await expect(execute(counterpartyId, query)).rejects.toBe(failure);
    expect(repoQuery).not.toHaveBeenCalled();
    repoQuery.mockRejectedValueOnce(failure);
    await expect(execute(counterpartyId, query)).rejects.toBe(failure);
  });
});
