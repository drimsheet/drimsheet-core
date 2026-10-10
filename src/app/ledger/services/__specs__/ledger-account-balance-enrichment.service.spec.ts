import mockReporter from '@shared/contracts/__mocks__/reporter.mock';
import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { ILedgerAccountBalance } from '@domain/ledger/types/ledger-account-balance.types';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerAccountStatus,
  ELedgerType,
  ENormalBalance,
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import { ICurrency } from '@domain/money/types/currency.types';
import moneyValue from '@domain/money/values/money.vo';

import { mockLedgerAccountBalanceRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import makeLedgerAccountBalanceEnrichmentAppService from '@app/ledger/services/ledger-account-balance-enrichment.service';

describe('ledgerAccountBalanceEnrichmentAppService', () => {
  const accountingEntityId =
    '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const userId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const timestamp = new Date('2026-08-09T10:00:00.000Z');
  const repoOptions: IReadRepoOptions = {
    correlationId: 'balance-enrichment-correlation-id',
  };
  const accountingEntity: IAccountingEntity = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: accountingEntityId,
    ownerId: userId,
    name: 'Balance Enrichment Entity',
    type: 'individual',
    functionalCurrencyCode: SYSTEM_CURRENCIES.USD.code,
    jurisdictionCode: 'US',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  function makeAccount(
    id: TEntityId,
    code: string,
    currency: ICurrency | null
  ): ILedgerAccount {
    return {
      id,
      version: 1,
      code,
      materializedPath: code,
      accountingEntityId,
      type: ELedgerType.Asset,
      normalBalance: ENormalBalance.Debit,
      subType: 'cash_and_cash_equivalent',
      behavior: 'cash',
      isControlAccount: false,
      controlAccountId: null,
      name: `Account ${code}`,
      currency,
      status: ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraNotPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctNotPermitted,
      meta: null,
      openingBalanceDate: null,
      createdBy: userId,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    };
  }

  function makeBalance(
    account: ILedgerAccount,
    amount: number,
    currency: ICurrency
  ): ILedgerAccountBalance {
    return {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      ledgerAccountId: account.id,
      accountingEntityId,
      accountMaterializedPath: account.materializedPath,
      amount: moneyValue.make(amount, currency, false),
      functionalAmount: moneyValue.make(amount, SYSTEM_CURRENCIES.USD, false),
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  const firstAccount = makeAccount(
    '123e4567-e89b-12d3-a456-426614174003' as TEntityId,
    '100001',
    SYSTEM_CURRENCIES.USD
  );
  const secondAccount = makeAccount(
    '123e4567-e89b-12d3-a456-426614174004' as TEntityId,
    '100002',
    SYSTEM_CURRENCIES.EUR
  );
  const currencyNeutralAccount = makeAccount(
    '123e4567-e89b-12d3-a456-426614174005' as TEntityId,
    '100003',
    null
  );
  const service = makeLedgerAccountBalanceEnrichmentAppService({
    ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
    reporter: mockReporter,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an empty array without reading balances for empty input', async () => {
    await expect(
      service.enrich([], accountingEntity, repoOptions)
    ).resolves.toEqual([]);

    expect(
      mockLedgerAccountBalanceRepo.findAllByAccountIds
    ).not.toHaveBeenCalled();
  });

  it('performs one scoped batch read and maps a single stored balance', async () => {
    const balance = makeBalance(firstAccount, 125, SYSTEM_CURRENCIES.USD);
    mockLedgerAccountBalanceRepo.findAllByAccountIds.mockResolvedValue([
      balance,
    ]);

    const result = await service.enrich(
      [firstAccount],
      accountingEntity,
      repoOptions
    );

    expect(
      mockLedgerAccountBalanceRepo.findAllByAccountIds
    ).toHaveBeenCalledWith(accountingEntityId, [firstAccount.id], repoOptions);
    expect(
      mockLedgerAccountBalanceRepo.findAllByAccountIds
    ).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: firstAccount.id,
      balance: {
        amount: 12500,
        currencyCode: SYSTEM_CURRENCIES.USD.code,
        isMinorUnit: true,
      },
      functionalBalance: {
        amount: 12500,
        currencyCode: SYSTEM_CURRENCIES.USD.code,
        isMinorUnit: true,
      },
    });
    expect(mockReporter.report).not.toHaveBeenCalled();
  });

  it('associates out-of-order balance rows while preserving input order', async () => {
    const firstBalance = makeBalance(firstAccount, 100, SYSTEM_CURRENCIES.USD);
    const secondBalance = makeBalance(
      secondAccount,
      200,
      SYSTEM_CURRENCIES.EUR
    );
    mockLedgerAccountBalanceRepo.findAllByAccountIds.mockResolvedValue([
      secondBalance,
      firstBalance,
    ]);

    const result = await service.enrich(
      [firstAccount, secondAccount],
      accountingEntity,
      repoOptions
    );

    expect(
      mockLedgerAccountBalanceRepo.findAllByAccountIds
    ).toHaveBeenCalledWith(
      accountingEntityId,
      [firstAccount.id, secondAccount.id],
      repoOptions
    );
    expect(
      mockLedgerAccountBalanceRepo.findAllByAccountIds
    ).toHaveBeenCalledTimes(1);
    expect(result.map(({ id }) => id)).toEqual([
      firstAccount.id,
      secondAccount.id,
    ]);
    expect(result.map(({ balance }) => balance.amount)).toEqual([10000, 20000]);
  });

  it('reports every missing balance and maps fixed and functional-currency zero fallbacks', async () => {
    const firstBalance = makeBalance(firstAccount, 100, SYSTEM_CURRENCIES.USD);
    mockLedgerAccountBalanceRepo.findAllByAccountIds.mockResolvedValue([
      firstBalance,
    ]);

    const result = await service.enrich(
      [firstAccount, secondAccount, currencyNeutralAccount],
      accountingEntity,
      repoOptions
    );

    expect(result.map(({ id }) => id)).toEqual([
      firstAccount.id,
      secondAccount.id,
      currencyNeutralAccount.id,
    ]);
    expect(mockReporter.report).toHaveBeenCalledTimes(2);
    expect(mockReporter.report).toHaveBeenNthCalledWith(
      1,
      'ledger.balance_enrichment.failed',
      expect.objectContaining({
        errorKey: 'app_error_ledger_balance_not_found',
        cause: { accountId: secondAccount.id },
      })
    );
    expect(mockReporter.report).toHaveBeenNthCalledWith(
      2,
      'ledger.balance_enrichment.failed',
      expect.objectContaining({
        errorKey: 'app_error_ledger_balance_not_found',
        cause: { accountId: currencyNeutralAccount.id },
      })
    );
    expect(result[1].balance).toEqual({
      amount: 0,
      currencyCode: SYSTEM_CURRENCIES.EUR.code,
      isMinorUnit: true,
    });
    expect(result[1].functionalBalance).toEqual({
      amount: 0,
      currencyCode: SYSTEM_CURRENCIES.USD.code,
      isMinorUnit: true,
    });
    expect(result[2].balance).toEqual({
      amount: 0,
      currencyCode: SYSTEM_CURRENCIES.USD.code,
      isMinorUnit: true,
    });
    expect(result[2].functionalBalance).toEqual({
      amount: 0,
      currencyCode: SYSTEM_CURRENCIES.USD.code,
      isMinorUnit: true,
    });
  });

  it('rejects an unexpected balance repository failure unchanged', async () => {
    const failure = new Error('balance repository unavailable');
    mockLedgerAccountBalanceRepo.findAllByAccountIds.mockRejectedValue(failure);

    await expect(
      service.enrich([firstAccount], accountingEntity, repoOptions)
    ).rejects.toBe(failure);

    expect(mockReporter.report).not.toHaveBeenCalled();
  });
});
