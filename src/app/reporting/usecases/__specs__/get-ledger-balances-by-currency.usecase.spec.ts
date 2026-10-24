import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';

import mockAppContext, {
  mockClientSession,
} from '@app/context/contracts/__mocks__/app-context.mock';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import mockLedgerBalancesByCurrencyQueryRepo from '@app/reporting/contracts/__mocks__/ledger-balances-by-currency.query.repo.mock';
import { ILedgerCurrencyAccountBalance } from '@app/reporting/contracts/ledger-balances-by-currency.query.repo.contract';
import reportingError from '@app/reporting/errors/reporting.error';
import makeGetLedgerBalancesByCurrencyUsecase from '@app/reporting/usecases/get-ledger-balances-by-currency.usecase';

const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const account: ILedgerCurrencyAccountBalance = {
  accountId: 'bank',
  currencyCode: 'USD',
  amount: 100_000n,
  functionalAmount: 150_000_000n,
};

describe('getLedgerBalancesByCurrencyUsecase', () => {
  const usecase = makeGetLedgerBalancesByCurrencyUsecase({
    appContext: mockAppContext,
    ledgerBalancesByCurrencyQueryRepo: mockLedgerBalancesByCurrencyQueryRepo,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      accountingEntity: {
        id: entityId,
        functionalCurrencyCode: 'NGN',
      } as IAccountingEntity,
      correlationId: 'currency-balances-spec',
      idempotencyKey: '',
      clientSession: mockClientSession,
    });
    mockLedgerBalancesByCurrencyQueryRepo.findAll.mockResolvedValue([]);
  });

  it.each(['asset', 'liability'] as const)(
    'reads only the requested %s class and returns an empty report without type',
    async (type) => {
      expect(await usecase(type)).toEqual({
        totalFunctionalBalance: {
          amount: 0,
          currencyCode: 'NGN',
          isMinorUnit: true,
        },
        balancesByCurrency: [],
      });
      expect(mockAppContext.get).toHaveBeenCalledWith(['accountingEntity']);
      expect(
        mockLedgerBalancesByCurrencyQueryRepo.findAll
      ).toHaveBeenCalledTimes(1);
      expect(
        mockLedgerBalancesByCurrencyQueryRepo.findAll
      ).toHaveBeenCalledWith(entityId, type, 'NGN', {
        correlationId: 'currency-balances-spec',
      });
    }
  );

  it('groups repeated currencies, preserves recorded valuations and reconciles the total', async () => {
    mockLedgerBalancesByCurrencyQueryRepo.findAll.mockResolvedValue([
      account,
      {
        accountId: 'local-bank',
        currencyCode: 'NGN',
        amount: 100_000_000n,
        functionalAmount: 100_000_000n,
      },
      {
        ...account,
        accountId: 'dollar-savings',
        amount: 50_000n,
        functionalAmount: 70_000_000n,
      },
    ]);

    expect(await usecase('asset')).toEqual({
      totalFunctionalBalance: {
        amount: 320_000_000,
        currencyCode: 'NGN',
        isMinorUnit: true,
      },
      balancesByCurrency: [
        {
          balance: {
            amount: 100_000_000,
            currencyCode: 'NGN',
            isMinorUnit: true,
          },
          functionalBalance: {
            amount: 100_000_000,
            currencyCode: 'NGN',
            isMinorUnit: true,
          },
        },
        {
          balance: { amount: 150_000, currencyCode: 'USD', isMinorUnit: true },
          functionalBalance: {
            amount: 220_000_000,
            currencyCode: 'NGN',
            isMinorUnit: true,
          },
        },
      ],
    });
  });

  it('keeps zero currency groups and signed balances without applying FX rates', async () => {
    mockLedgerBalancesByCurrencyQueryRepo.findAll.mockResolvedValue([
      { ...account, amount: 30n, functionalAmount: 400n },
      {
        ...account,
        accountId: 'offset',
        amount: -30n,
        functionalAmount: -500n,
      },
      {
        accountId: 'zero',
        currencyCode: 'JPY',
        amount: 0n,
        functionalAmount: 0n,
      },
    ]);
    const response = await usecase('liability');
    expect(response.totalFunctionalBalance.amount).toBe(-100);
    expect(response.balancesByCurrency).toEqual([
      {
        balance: { amount: 0, currencyCode: 'JPY', isMinorUnit: true },
        functionalBalance: {
          amount: 0,
          currencyCode: 'NGN',
          isMinorUnit: true,
        },
      },
      {
        balance: { amount: 0, currencyCode: 'USD', isMinorUnit: true },
        functionalBalance: {
          amount: -100,
          currencyCode: 'NGN',
          isMinorUnit: true,
        },
      },
    ]);
  });

  it('returns signed native and functional minor-unit DTOs without extra fields', async () => {
    mockLedgerBalancesByCurrencyQueryRepo.findAll.mockResolvedValue([
      { ...account, amount: -100n, functionalAmount: -1500n },
    ]);

    expect(await usecase('asset')).toEqual({
      totalFunctionalBalance: {
        amount: -1500,
        currencyCode: 'NGN',
        isMinorUnit: true,
      },
      balancesByCurrency: [
        {
          balance: { amount: -100, currencyCode: 'USD', isMinorUnit: true },
          functionalBalance: {
            amount: -1500,
            currencyCode: 'NGN',
            isMinorUnit: true,
          },
        },
      ],
    });
  });

  it('uses the entity functional currency even when there are no accounts', async () => {
    mockAppContext.get.mockReturnValue({
      accountingEntity: {
        id: entityId,
        functionalCurrencyCode: 'JPY',
      } as IAccountingEntity,
      correlationId: 'currency-balances-spec',
      idempotencyKey: '',
      clientSession: mockClientSession,
    });
    expect(await usecase('asset')).toEqual({
      totalFunctionalBalance: {
        amount: 0,
        currencyCode: 'JPY',
        isMinorUnit: true,
      },
      balancesByCurrency: [],
    });
  });

  it.each([
    undefined,
    null,
    '',
    'revenue',
    'expense',
    'equity',
    'ASSET',
    ['asset'],
  ])(
    'rejects invalid type %j before context or storage reads',
    async (type) => {
      await expect(
        usecase(type as Parameters<typeof usecase>[0])
      ).rejects.toThrow(appError.UnprocessableEntity);
      expect(mockAppContext.get).not.toHaveBeenCalled();
      expect(
        mockLedgerBalancesByCurrencyQueryRepo.findAll
      ).not.toHaveBeenCalled();
    }
  );

  it.each([
    { amount: null, functionalAmount: null },
    { amount: null, functionalAmount: 10n },
    { amount: 10n, functionalAmount: null },
  ])('rejects an incomplete stored balance %j', async (amounts) => {
    mockLedgerBalancesByCurrencyQueryRepo.findAll.mockResolvedValue([
      { ...account, ...amounts },
    ]);
    await expect(usecase('asset')).rejects.toThrow(
      ledgerAppError.BalanceNotFound
    );
  });

  it.each([
    { amount: 100_000_000_000_001n },
    { amount: -100_000_000_000_001n },
    { functionalAmount: 100_000_000_000_001n },
    { functionalAmount: -100_000_000_000_001n },
    { currencyCode: 'JPY', amount: 1_000_000_000_001n },
  ])('enforces each currency amount ceiling for %j', async (amounts) => {
    mockLedgerBalancesByCurrencyQueryRepo.findAll.mockResolvedValue([
      { ...account, ...amounts },
    ]);
    await expect(usecase('asset')).rejects.toThrow(
      reportingError.ReportAmountLimitExceeded
    );
  });

  it.each([
    { amount: 60_000_000_000_000n, functionalAmount: 1n },
    { amount: 1n, functionalAmount: 60_000_000_000_000n },
  ])('checks grouped balances after aggregation %j', async (amounts) => {
    mockLedgerBalancesByCurrencyQueryRepo.findAll.mockResolvedValue([
      { ...account, ...amounts },
      { ...account, accountId: 'second', ...amounts },
    ]);
    await expect(usecase('asset')).rejects.toThrow(
      reportingError.ReportAmountLimitExceeded
    );
  });

  it('checks the total across currencies even when individual groups are within limits', async () => {
    mockLedgerBalancesByCurrencyQueryRepo.findAll.mockResolvedValue([
      { ...account, functionalAmount: 60_000_000_000_000n },
      {
        ...account,
        accountId: 'euro',
        currencyCode: 'EUR',
        functionalAmount: 60_000_000_000_000n,
      },
    ]);
    await expect(usecase('asset')).rejects.toThrow(
      reportingError.ReportAmountLimitExceeded
    );
  });

  it('propagates storage failures', async () => {
    const failure = new Error('read failed');
    mockLedgerBalancesByCurrencyQueryRepo.findAll.mockRejectedValue(failure);
    await expect(usecase('asset')).rejects.toBe(failure);
  });
});
