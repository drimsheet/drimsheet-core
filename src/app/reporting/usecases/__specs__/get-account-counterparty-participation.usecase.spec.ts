import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import { ILedgerAccountBalance } from '@domain/ledger/types/ledger-account-balance.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';

import mockAppContext, {
  mockClientSession,
} from '@app/context/contracts/__mocks__/app-context.mock';
import {
  mockLedgerAccountBalanceRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import mockAccountCounterpartyParticipationQueryRepo from '@app/reporting/contracts/__mocks__/account-counterparty-participation.query.repo.mock';
import { IAccountCounterpartyParticipationAggregate } from '@app/reporting/contracts/account-counterparty-participation.query.repo.contract';
import reportingError from '@app/reporting/errors/reporting.error';
import makeGetAccountCounterpartyParticipationUsecase from '@app/reporting/usecases/get-account-counterparty-participation.usecase';

const accountId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const [counterparty] = counterpartyEntity.make({
  accountingEntityId: entityId,
  createdBy: entityId,
  name: 'Alice',
  type: 'individual',
  status: 'archived',
});
const account = {
  id: accountId,
  accountingEntityId: entityId,
  currency: SYSTEM_CURRENCIES.USD,
  isControlAccount: false,
} as ILedgerAccount;
const balance = {
  ledgerAccountId: accountId,
  amount: moneyValue.make(10000n, SYSTEM_CURRENCIES.USD, true),
  functionalAmount: moneyValue.make(200000n, SYSTEM_CURRENCIES.NGN, true),
} as ILedgerAccountBalance;
const aggregate: IAccountCounterpartyParticipationAggregate = {
  counterparty,
  isSelf: false,
  normalBalance: 'credit',
  debits: 1000n,
  credits: 4000n,
  functionalDebits: 10000n,
  functionalCredits: 60000n,
};

describe('getAccountCounterpartyParticipationUsecase', () => {
  const usecase = makeGetAccountCounterpartyParticipationUsecase({
    appContext: mockAppContext,
    ledgerAccountRepo: mockLedgerAccountRepo,
    ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
    accountCounterpartyParticipationQueryRepo:
      mockAccountCounterpartyParticipationQueryRepo,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      accountingEntity: {
        id: entityId,
        name: 'My Books',
        functionalCurrencyCode: 'NGN',
      } as IAccountingEntity,
      correlationId: 'participation-spec',
      idempotencyKey: '',
      clientSession: mockClientSession,
    });
    mockLedgerAccountRepo.findById.mockResolvedValue(account);
    mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValue(balance);
    mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount.mockResolvedValue(
      [aggregate]
    );
  });

  it('scopes all reads to the current entity and uses the stored account balance for shares', async () => {
    const response = await usecase(accountId, {});
    const options = { correlationId: 'participation-spec' };
    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
      accountId,
      entityId,
      options
    );
    expect(mockLedgerAccountBalanceRepo.findByAccountId).toHaveBeenCalledWith(
      accountId,
      entityId,
      options
    );
    expect(
      mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount
    ).toHaveBeenCalledWith(
      {
        accountId,
        accountingEntityId: entityId,
        functionalCurrencyCode: 'NGN',
      },
      options
    );
    expect(response.meta).toEqual({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
    expect(response.data[0]).toMatchObject({
      counterparty: { id: counterparty.id, name: 'Alice', status: 'archived' },
      isSelf: false,
      participation: {
        amount: { amount: 3000, currencyCode: 'USD', isMinorUnit: true },
        functionalAmount: {
          amount: 50000,
          currencyCode: 'NGN',
          isMinorUnit: true,
        },
        totalShare: 30,
      },
    });
    expect(response.data[0].counterparty).not.toHaveProperty('version');
  });

  it('supports control accounts and functional-currency balances without imposing posting restrictions', async () => {
    mockLedgerAccountRepo.findById.mockResolvedValue({
      ...account,
      currency: null,
      isControlAccount: true,
    });
    mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValue({
      ...balance,
      amount: balance.functionalAmount,
    });
    mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount.mockResolvedValue(
      [
        {
          ...aggregate,
          debits: aggregate.functionalDebits,
          credits: aggregate.functionalCredits,
        },
      ]
    );
    const response = await usecase(accountId, {});
    expect(response.data[0].participation).toEqual({
      amount: { amount: 50000, currencyCode: 'NGN', isMinorUnit: true },
      functionalAmount: {
        amount: 50000,
        currencyCode: 'NGN',
        isMinorUnit: true,
      },
      totalShare: 25,
    });
  });

  it('searches counterparty names case-insensitively and paginates groups without changing shares', async () => {
    mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount.mockResolvedValue(
      [
        aggregate,
        {
          ...aggregate,
          counterparty: { ...counterparty, id: accountId, name: 'ALICE Jones' },
        },
        { ...aggregate, counterparty: null, isSelf: true },
        { ...aggregate, counterparty: null, isSelf: false },
      ]
    );
    const response = await usecase(accountId, {
      search: 'aLiCe',
      page: 2,
      limit: 1,
    });
    expect(response.meta).toEqual({
      page: 2,
      limit: 1,
      total: 2,
      totalPages: 2,
    });
    expect(response.data[0].counterparty?.name).toBe('ALICE Jones');
    expect(response.data[0].participation.totalShare).toBe(30);
    expect((await usecase(accountId, { search: 'missing' })).data).toEqual([]);
    expect((await usecase(accountId, { page: 5, limit: 1 })).data).toEqual([]);
  });

  it('matches self transfers by entity name without matching unrelated unattributed activity', async () => {
    mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount.mockResolvedValue(
      [
        aggregate,
        { ...aggregate, counterparty: null, isSelf: true },
        { ...aggregate, counterparty: null, isSelf: false },
      ]
    );
    const response = await usecase(accountId, { search: 'MY books' });
    expect(response.meta.total).toBe(1);
    expect(response.data[0]).toMatchObject({
      counterparty: null,
      isSelf: true,
    });
    expect((await usecase(accountId, {})).data).toHaveLength(3);
  });

  it('applies default pagination to grouped participants and handles empty accounts', async () => {
    mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount.mockResolvedValue(
      Array.from({ length: 12 }, (_, index) => ({
        ...aggregate,
        counterparty: {
          ...counterparty,
          id: `123e4567-e89b-12d3-a456-${String(index).padStart(12, '0')}` as TEntityId,
        },
      }))
    );
    const response = await usecase(accountId, {});
    expect(response.data).toHaveLength(10);
    expect(response.meta).toEqual({
      page: 1,
      limit: 10,
      total: 12,
      totalPages: 2,
    });
    mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount.mockResolvedValue(
      []
    );
    expect(await usecase(accountId, {})).toEqual({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
  });

  it('rejects invalid IDs and pagination before reading storage', async () => {
    await expect(usecase('bad-id', {})).rejects.toThrow(
      reportingError.InvalidAccountId
    );
    await expect(usecase(accountId, { page: 1.5 })).rejects.toThrow(
      appError.UnprocessableEntity
    );
    expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
  });

  it('rejects missing or foreign accounts before reading balances or contributions', async () => {
    mockLedgerAccountRepo.findById.mockResolvedValue(null);
    await expect(usecase(accountId, {})).rejects.toThrow(
      reportingError.AccountNotFound
    );
    expect(mockLedgerAccountBalanceRepo.findByAccountId).not.toHaveBeenCalled();
    expect(
      mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount
    ).not.toHaveBeenCalled();
  });

  it('rejects missing balances instead of inventing a denominator', async () => {
    mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValue(null);
    await expect(usecase(accountId, {})).rejects.toThrow(
      ledgerAppError.BalanceNotFound
    );
    expect(
      mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount
    ).not.toHaveBeenCalled();
  });

  it('propagates read failures without returning a partial report', async () => {
    const failure = new Error('unavailable');
    mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount.mockRejectedValue(
      failure
    );
    await expect(usecase(accountId, {})).rejects.toBe(failure);
  });

  describe('participation calculations', () => {
    const contribution: IAccountCounterpartyParticipationAggregate = {
      counterparty,
      isSelf: false,
      normalBalance: 'debit',
      debits: 120n,
      credits: 20n,
      functionalDebits: 180n,
      functionalCredits: 30n,
    };

    beforeEach(() => {
      mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValue({
        ...balance,
        amount: moneyValue.make(300n, SYSTEM_CURRENCIES.USD, true),
      });
      mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount.mockResolvedValue(
        [contribution]
      );
    });

    it('combines descendant contributions by identity using each posting account normal side', async () => {
      mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount.mockResolvedValue(
        [
          contribution,
          {
            ...contribution,
            normalBalance: 'credit',
            debits: 50n,
            credits: 100n,
            functionalDebits: 75n,
            functionalCredits: 150n,
          },
          { ...contribution, counterparty: { ...counterparty, id: entityId } },
        ]
      );
      const report = await usecase(accountId, {});
      expect(report.data).toHaveLength(2);
      expect(report.data[0]).toMatchObject({
        counterparty: { id: counterparty.id },
        isSelf: false,
        participation: {
          amount: { amount: 150, currencyCode: 'USD', isMinorUnit: true },
          functionalAmount: {
            amount: 225,
            currencyCode: 'NGN',
            isMinorUnit: true,
          },
          totalShare: 50,
        },
      });
      expect(report.data[1].participation.amount.amount).toBe(100);
      expect(report.data[1].participation.totalShare).toBe(33.33);
    });

    it('keeps self and unattributed groups separate and retains zero net activity', async () => {
      mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount.mockResolvedValue(
        [
          { ...contribution, counterparty: null, isSelf: true },
          { ...contribution, counterparty: null, isSelf: false },
          {
            ...contribution,
            counterparty: null,
            isSelf: true,
            debits: 20n,
            credits: 120n,
            functionalDebits: 30n,
            functionalCredits: 180n,
          },
        ]
      );
      const report = await usecase(accountId, {});
      expect(
        report.data.map((row) => [
          row.isSelf,
          row.participation.amount.amount,
          row.participation.functionalAmount.amount,
          row.participation.totalShare,
        ])
      ).toEqual([
        [true, 0, 0, 0],
        [false, 100, 150, 33.33],
      ]);
    });

    it('returns null shares at zero balance, including accounts without contributions', async () => {
      mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValue({
        ...balance,
        amount: moneyValue.makeZeroAmount(SYSTEM_CURRENCIES.USD),
      });
      expect(
        (await usecase(accountId, {})).data[0].participation.totalShare
      ).toBeNull();
      mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount.mockResolvedValue(
        []
      );
      expect((await usecase(accountId, {})).data).toEqual([]);
    });

    it('preserves negative and above-100 shares without taking absolute values', async () => {
      mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount.mockResolvedValue(
        [
          { ...contribution, debits: 400n, credits: 0n },
          { ...contribution, counterparty: null, normalBalance: 'credit' },
        ]
      );
      const report = await usecase(accountId, {});
      expect(report.data.map((row) => row.participation.totalShare)).toEqual([
        133.33, -33.33,
      ]);
      mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValue({
        ...balance,
        amount: moneyValue.make(-300n, SYSTEM_CURRENCIES.USD, true),
      });
      mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount.mockResolvedValue(
        [contribution]
      );
      expect(
        (await usecase(accountId, {})).data[0].participation.totalShare
      ).toBe(-33.33);
    });

    it('validates both contribution currencies and the stored denominator against reporting limits', async () => {
      const tooLarge = 100_000_000_000_001n;
      mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount.mockResolvedValue(
        [{ ...contribution, credits: tooLarge + contribution.debits }]
      );
      await expect(usecase(accountId, {})).rejects.toThrow(
        reportingError.ReportAmountLimitExceeded
      );
      mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount.mockResolvedValue(
        [
          {
            ...contribution,
            functionalDebits: tooLarge + contribution.functionalCredits,
          },
        ]
      );
      await expect(usecase(accountId, {})).rejects.toThrow(
        reportingError.ReportAmountLimitExceeded
      );
      mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValue({
        ...balance,
        amount: moneyValue.make(tooLarge, SYSTEM_CURRENCIES.USD, true),
      });
      mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount.mockResolvedValue(
        []
      );
      await expect(usecase(accountId, {})).rejects.toThrow(
        reportingError.ReportAmountLimitExceeded
      );
    });

    it('rejects unsafe serialization before percentage arithmetic', async () => {
      const unsafeCurrency = { ...SYSTEM_CURRENCIES.USD, minorUnit: 6 };
      mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValue({
        ...balance,
        amount: moneyValue.make(9007199254740993n, unsafeCurrency, true),
      });
      await expect(usecase(accountId, {})).rejects.toThrow(
        reportingError.AmountOutOfRange
      );
      mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValue({
        ...balance,
        amount: moneyValue.make(1n, unsafeCurrency, true),
      });
      mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount.mockResolvedValue(
        [{ ...contribution, debits: 9007199254740993n, credits: 0n }]
      );
      await expect(usecase(accountId, {})).rejects.toThrow(
        reportingError.AmountOutOfRange
      );
    });
  });
});
