import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';
import dateError from '@shared/values/errors/date.error';

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
import reportingError from '@app/ledger/errors/reporting.error';

import makeGetAccountBalanceContributionsByCounterpartyUsecase, {
  IGetAccountBalanceContributionsByCounterpartyRepoQueryOutput,
  TGetAccountBalanceContributionsByCounterpartyRepoQuery,
} from './account-balance-contributions-by-counterparty.usecase';
import {
  accountBalanceContributionsByCounterpartyMapper,
  getAccountBalanceContributionsByCounterpartyQueryValidationSchema as schema,
} from './dto';

const mockAccountBalanceContributionsByCounterpartyRepoQuery: jest.MockedFunction<TGetAccountBalanceContributionsByCounterpartyRepoQuery> =
  jest.fn();

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
const aggregate: IGetAccountBalanceContributionsByCounterpartyRepoQueryOutput =
  {
    counterparty,
    isSelf: false,
    normalBalance: 'credit',
    debits: 1000n,
    credits: 4000n,
    functionalDebits: 10000n,
    functionalCredits: 60000n,
  };

describe('getAccountBalanceContributionsByCounterpartyUsecase', () => {
  const usecase = makeGetAccountBalanceContributionsByCounterpartyUsecase({
    appContext: mockAppContext,
    ledgerAccountRepo: mockLedgerAccountRepo,
    ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
    repoQuery: mockAccountBalanceContributionsByCounterpartyRepoQuery,
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
    mockAccountBalanceContributionsByCounterpartyRepoQuery.mockResolvedValue([
      aggregate,
    ]);
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
      mockAccountBalanceContributionsByCounterpartyRepoQuery
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

  it.each([
    { from: '2026-10-01', to: '2026-10-31' },
    { from: '2026-10-01' },
    { to: '2026-10-31' },
    { from: '2026-10-01', to: '2026-10-01' },
    { from: '1970-01-01', to: '1970-01-01' },
  ])(
    'passes inclusive date bounds and uses period totals for %j',
    async (query) => {
      const response = await usecase(accountId, query);
      expect(
        mockAccountBalanceContributionsByCounterpartyRepoQuery
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          from: query.from === undefined ? undefined : new Date(query.from),
          to: query.to === undefined ? undefined : new Date(query.to),
        }),
        { correlationId: 'participation-spec' }
      );
      expect(response.data[0].participation.totalShare).toBe(100);
    }
  );

  it('rejects reversed bounds and invalid dates before reading storage', async () => {
    await expect(
      usecase(accountId, { from: '2026-10-31', to: '2026-10-01' })
    ).rejects.toThrow(dateError.InvalidDates);
    await expect(usecase(accountId, { from: '2026-02-30' })).rejects.toThrow(
      appError.UnprocessableEntity
    );
    expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
  });

  it('calculates period shares before search and pagination including self and unattributed activity', async () => {
    mockAccountBalanceContributionsByCounterpartyRepoQuery.mockResolvedValue([
      aggregate,
      { ...aggregate, counterparty: null, isSelf: true },
      { ...aggregate, counterparty: null, isSelf: false },
    ]);
    const response = await usecase(accountId, {
      from: '2026-10-01',
      search: 'Alice',
      limit: 1,
    });
    expect(response.data).toHaveLength(1);
    expect(response.data[0].participation.totalShare).toBe(33.33);
  });

  it('uses signed period totals and returns null shares when period activity nets to zero', async () => {
    mockAccountBalanceContributionsByCounterpartyRepoQuery.mockResolvedValue([
      aggregate,
      {
        ...aggregate,
        counterparty: null,
        normalBalance: 'debit',
        debits: 0n,
        credits: 1000n,
      },
    ]);
    const response = await usecase(accountId, { to: '2026-10-31' });
    expect(response.data.map((row) => row.participation.totalShare)).toEqual([
      150, -50,
    ]);
    mockAccountBalanceContributionsByCounterpartyRepoQuery.mockResolvedValue([
      aggregate,
      { ...aggregate, counterparty: null, normalBalance: 'debit' },
    ]);
    const zero = await usecase(accountId, { to: '2026-10-31' });
    expect(zero.data.map((row) => row.participation.totalShare)).toEqual([
      null,
      null,
    ]);
    mockAccountBalanceContributionsByCounterpartyRepoQuery.mockResolvedValue(
      []
    );
    expect((await usecase(accountId, { to: '2026-10-31' })).data).toEqual([]);
  });

  it('validates the period denominator independently of the stored balance', async () => {
    mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValue({
      ...balance,
      amount: moneyValue.makeZeroAmount(SYSTEM_CURRENCIES.USD),
    });
    expect(
      (await usecase(accountId, { from: '2026-10-01' })).data[0].participation
        .totalShare
    ).toBe(100);
    mockAccountBalanceContributionsByCounterpartyRepoQuery.mockResolvedValue([
      { ...aggregate, debits: 0n, credits: 60_000_000_000_000n },
      {
        ...aggregate,
        counterparty: null,
        debits: 0n,
        credits: 60_000_000_000_000n,
      },
    ]);
    await expect(usecase(accountId, { from: '2026-10-01' })).rejects.toThrow(
      reportingError.ReportAmountLimitExceeded
    );
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
    mockAccountBalanceContributionsByCounterpartyRepoQuery.mockResolvedValue([
      {
        ...aggregate,
        debits: aggregate.functionalDebits,
        credits: aggregate.functionalCredits,
      },
    ]);
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
    mockAccountBalanceContributionsByCounterpartyRepoQuery.mockResolvedValue([
      aggregate,
      {
        ...aggregate,
        counterparty: { ...counterparty, id: accountId, name: 'ALICE Jones' },
      },
      { ...aggregate, counterparty: null, isSelf: true },
      { ...aggregate, counterparty: null, isSelf: false },
    ]);
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
    mockAccountBalanceContributionsByCounterpartyRepoQuery.mockResolvedValue([
      aggregate,
      { ...aggregate, counterparty: null, isSelf: true },
      { ...aggregate, counterparty: null, isSelf: false },
    ]);
    const response = await usecase(accountId, { search: 'MY books' });
    expect(response.meta.total).toBe(1);
    expect(response.data[0]).toMatchObject({
      counterparty: null,
      isSelf: true,
    });
    expect((await usecase(accountId, {})).data).toHaveLength(3);
  });

  it('applies default pagination to grouped participants and handles empty accounts', async () => {
    mockAccountBalanceContributionsByCounterpartyRepoQuery.mockResolvedValue(
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
    mockAccountBalanceContributionsByCounterpartyRepoQuery.mockResolvedValue(
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
      mockAccountBalanceContributionsByCounterpartyRepoQuery
    ).not.toHaveBeenCalled();
  });

  it('rejects missing balances instead of inventing a denominator', async () => {
    mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValue(null);
    await expect(usecase(accountId, {})).rejects.toThrow(
      ledgerAppError.BalanceNotFound
    );
    expect(
      mockAccountBalanceContributionsByCounterpartyRepoQuery
    ).not.toHaveBeenCalled();
  });

  it('propagates read failures without returning a partial report', async () => {
    const failure = new Error('unavailable');
    mockAccountBalanceContributionsByCounterpartyRepoQuery.mockRejectedValue(
      failure
    );
    await expect(usecase(accountId, {})).rejects.toBe(failure);
  });

  describe('participation calculations', () => {
    const contribution: IGetAccountBalanceContributionsByCounterpartyRepoQueryOutput =
      {
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
      mockAccountBalanceContributionsByCounterpartyRepoQuery.mockResolvedValue([
        contribution,
      ]);
    });

    it('combines descendant contributions by identity using each posting account normal side', async () => {
      mockAccountBalanceContributionsByCounterpartyRepoQuery.mockResolvedValue([
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
      ]);
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
      mockAccountBalanceContributionsByCounterpartyRepoQuery.mockResolvedValue([
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
      ]);
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
      mockAccountBalanceContributionsByCounterpartyRepoQuery.mockResolvedValue(
        []
      );
      expect((await usecase(accountId, {})).data).toEqual([]);
    });

    it('preserves negative and above-100 shares without taking absolute values', async () => {
      mockAccountBalanceContributionsByCounterpartyRepoQuery.mockResolvedValue([
        { ...contribution, debits: 400n, credits: 0n },
        { ...contribution, counterparty: null, normalBalance: 'credit' },
      ]);
      const report = await usecase(accountId, {});
      expect(report.data.map((row) => row.participation.totalShare)).toEqual([
        133.33, -33.33,
      ]);
      mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValue({
        ...balance,
        amount: moneyValue.make(-300n, SYSTEM_CURRENCIES.USD, true),
      });
      mockAccountBalanceContributionsByCounterpartyRepoQuery.mockResolvedValue([
        contribution,
      ]);
      expect(
        (await usecase(accountId, {})).data[0].participation.totalShare
      ).toBe(-33.33);
    });

    it('validates both contribution currencies and the stored denominator against reporting limits', async () => {
      const tooLarge = 100_000_000_000_001n;
      mockAccountBalanceContributionsByCounterpartyRepoQuery.mockResolvedValue([
        { ...contribution, credits: tooLarge + contribution.debits },
      ]);
      await expect(usecase(accountId, {})).rejects.toThrow(
        reportingError.ReportAmountLimitExceeded
      );
      mockAccountBalanceContributionsByCounterpartyRepoQuery.mockResolvedValue([
        {
          ...contribution,
          functionalDebits: tooLarge + contribution.functionalCredits,
        },
      ]);
      await expect(usecase(accountId, {})).rejects.toThrow(
        reportingError.ReportAmountLimitExceeded
      );
      mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValue({
        ...balance,
        amount: moneyValue.make(tooLarge, SYSTEM_CURRENCIES.USD, true),
      });
      mockAccountBalanceContributionsByCounterpartyRepoQuery.mockResolvedValue(
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
      mockAccountBalanceContributionsByCounterpartyRepoQuery.mockResolvedValue([
        { ...contribution, debits: 9007199254740993n, credits: 0n },
      ]);
      await expect(usecase(accountId, {})).rejects.toThrow(
        reportingError.AmountOutOfRange
      );
    });
  });
});
describe('getAccountBalanceContributionsByCounterpartyQueryValidationSchema', () => {
  it.each([
    {},
    { page: 1, limit: 200, search: 'Alice' },
    { search: '' },
    { from: '2026-10-01' },
    { to: '2026-10-31' },
  ])('accepts %j', (query) => {
    expect(schema.safeParse(query).success).toBe(true);
  });

  it.each([
    { page: 0 },
    { page: -1 },
    { page: 1.5 },
    { limit: 0 },
    { limit: 201 },
    { limit: 1.5 },
    { limit: '10' },
    { search: 1 },
    { from: '2026-02-30' },
    { to: '0000-01-01' },
    { from: '2026-10-01T00:00:00Z' },
    { to: 'invalid' },
  ])('rejects %j', (query) => {
    expect(schema.safeParse(query).success).toBe(false);
  });
});

describe('accountBalanceContributionsByCounterpartyMapper', () => {
  const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const [counterparty] = counterpartyEntity.make({
    accountingEntityId: entityId,
    createdBy: entityId,
    name: 'Alice',
    type: 'individual',
  });
  const row = {
    counterparty,
    isSelf: false,
    amount: moneyValue.make(-120n, SYSTEM_CURRENCIES.USD, true),
    functionalAmount: moneyValue.make(-180n, SYSTEM_CURRENCIES.NGN, true),
    totalShare: -12,
  };

  it('maps both currencies and full counterparty details without exposing domain versions', () => {
    const dto = accountBalanceContributionsByCounterpartyMapper.toDto(row);
    expect(dto).toEqual({
      counterparty: {
        id: counterparty.id,
        createdBy: entityId,
        accountingEntityId: entityId,
        name: 'Alice',
        status: 'active',
        type: 'individual',
        roles: [],
        meta: {},
        createdAt: counterparty.createdAt,
        updatedAt: counterparty.updatedAt,
      },
      isSelf: false,
      participation: {
        amount: { amount: -120, currencyCode: 'USD', isMinorUnit: true },
        functionalAmount: {
          amount: -180,
          currencyCode: 'NGN',
          isMinorUnit: true,
        },
        totalShare: -12,
      },
    });
  });

  it.each([true, false])(
    'preserves a null counterparty with isSelf=%s and a null share',
    (isSelf) => {
      const dto = accountBalanceContributionsByCounterpartyMapper.toDto({
        ...row,
        counterparty: null,
        isSelf,
        totalShare: null,
      });
      expect(dto.counterparty).toBeNull();
      expect(dto.isSelf).toBe(isSelf);
      expect(dto.participation.totalShare).toBeNull();
    }
  );
});
