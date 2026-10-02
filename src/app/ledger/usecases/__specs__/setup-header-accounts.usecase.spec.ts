import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import { ERepoLock } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import {
  EAccountingEntityType,
  IAccountingEntity,
} from '@domain/accounting/types/accounting-entity.types';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import makeCashAccountService from '@domain/ledger/services/asset-account/cash-account.service';
import makeReceivablesAccountService from '@domain/ledger/services/asset-account/receivables-account.service';
import makeEquityAccountService from '@domain/ledger/services/equity-account/equity-account.service';
import makeAssetDisposalService from '@domain/ledger/services/expense-account/asset-disposal-loss.service';
import makeBankChargeAccountService from '@domain/ledger/services/expense-account/bank-charge.service';
import makeDirectCostsAccountService from '@domain/ledger/services/expense-account/direct-costs.service';
import makeFinanceCostAccountService from '@domain/ledger/services/expense-account/finance-cost.service';
import makeInterestAccountService from '@domain/ledger/services/expense-account/interest.service';
import makeRentAndUtilitiesAccountService from '@domain/ledger/services/expense-account/rent-and-utilities.service';
import makeTaxExpenseAccountService from '@domain/ledger/services/expense-account/tax-expense.service';
import makeUnrealizedLossAccountService from '@domain/ledger/services/expense-account/unrealized-loss.service';
import makeLedgerCodeAllocationService from '@domain/ledger/services/ledger-code-allocation.service';
import makePayablesAccountService from '@domain/ledger/services/liability-account/payables.service';
import makeShortTermLoanService from '@domain/ledger/services/liability-account/short-term-loan.service';
import makeEmploymentIncomeAccountService from '@domain/ledger/services/revenue-account/employment-income.service';
import makeGainOnAssetSaleAccountService from '@domain/ledger/services/revenue-account/gain-on-sale.service';
import makeGiftsAccountService from '@domain/ledger/services/revenue-account/gifts.service';
import makeGrantsAccountService from '@domain/ledger/services/revenue-account/grants.service';
import makeServicesAccountService from '@domain/ledger/services/revenue-account/services.service';
import makeUnrealizedGainAccountService from '@domain/ledger/services/revenue-account/unrealized-gain.service';
import { ILedgerAccountHistory } from '@domain/ledger/types/ledger-account-audit.types';
import { ILedgerAccountBalance } from '@domain/ledger/types/ledger-account-balance.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import actorEntity from '@domain/user/entities/actor.entity';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import mockLedgerAccountPersistenceService from '@app/ledger/contracts/__mocks__/ledger-account-persistence.service.mock';
import {
  mockAssetAccountService,
  mockAssetDisposalLossAccountService,
  mockBankChargeAccountService,
  mockDirectCostsAccountService,
  mockEmploymentIncomeAccountService,
  mockEquityAccountService,
  mockFinanceCostAccountService,
  mockGainOnAssetSaleAccountService,
  mockGiftsAccountService,
  mockGrantsAccountService,
  mockInterestAccountService,
  mockPayablesAccountService,
  mockReceivablesAccountService,
  mockRentAndUtilitiesAccountService,
  mockServicesAccountService,
  mockShortTermLoanAccountService,
  mockTaxExpenseAccountService,
  mockUnrealizedGainAccountService,
  mockUnrealizedLossAccountService,
} from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import {
  mockBankAccountRepo,
  mockLedgerAccountBalanceRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import { IHeaderAccountNameAliasesReq } from '@app/ledger/dtos/header-account/header-account.dto';
import makeLedgerAccountPersistenceService from '@app/ledger/services/ledger-account-persistence.service';
import makeGetRecommendedBootstrapUsecase from '@app/ledger/usecases/get-recommended-bootstrap.usecase';
import makeSetupHeaderAccountsUsecase from '@app/ledger/usecases/setup-header-accounts.usecase';

const actor = actorEntity.makeUser({
  email: 'header@example.com',
  displayName: 'Header Owner',
})[0];
const accountingEntity = {
  id: '123e4567-e89b-42d3-a456-426614174001' as TEntityId,
  ownerId: '123e4567-e89b-42d3-a456-426614174002' as TEntityId,
  createdBy: actor.id,
  type: EAccountingEntityType.Individual,
  functionalCurrencyCode: 'NGN',
} as IAccountingEntity;
const correlationId = 'header-setup-spec';
const tx = mockRepoTransaction.context;
const repoOptions = { correlationId };
const domainCalls = [
  [
    'cash_and_cash_equivalent',
    mockAssetAccountService.createHeader,
    'Cash and Cash Equivalents',
  ],
  ['receivables', mockReceivablesAccountService.createHeader, 'Receivables'],
  [
    'short_term_debt',
    mockShortTermLoanAccountService.createHeader,
    'Short Term Debt',
  ],
  ['payable', mockPayablesAccountService.createHeader, 'Payables'],
  [
    'retained_earnings',
    mockEquityAccountService.createRetainedEarningsAccount,
    'Retained Earnings',
  ],
  [
    'opening_balance',
    mockEquityAccountService.createOpeningBalanceAccount,
    'Opening Balance Equity',
  ],
  ['services', mockServicesAccountService.createHeader, 'Services'],
  [
    'employment_income',
    mockEmploymentIncomeAccountService.createHeader,
    'Employment Income',
  ],
  [
    'gain_on_asset_sale',
    mockGainOnAssetSaleAccountService.createHeader,
    'Gain on Sale of Assets',
  ],
  [
    'unrealized_gains',
    mockUnrealizedGainAccountService.createHeader,
    'Unrealized Gain',
  ],
  ['grants', mockGrantsAccountService.createHeader, 'Grants'],
  ['gifts', mockGiftsAccountService.createHeader, 'Gifts'],
  ['direct_costs', mockDirectCostsAccountService.createHeader, 'Direct Costs'],
  [
    'rent_and_utilities',
    mockRentAndUtilitiesAccountService.createHeader,
    'Rent and Utilities',
  ],
  ['bank_charge', mockBankChargeAccountService.createHeader, 'Bank Charge'],
  ['finance_cost', mockFinanceCostAccountService.createHeader, 'Finance Cost'],
  ['interest', mockInterestAccountService.createHeader, 'Interest'],
  [
    'income_tax_expense',
    mockTaxExpenseAccountService.createHeader,
    'Tax Expense',
  ],
  [
    'unrealized_loss',
    mockUnrealizedLossAccountService.createHeader,
    'Unrealized Loss',
  ],
  [
    'loss_on_asset_disposal',
    mockAssetDisposalLossAccountService.createHeader,
    'Asset Disposal Loss',
  ],
] as const;
const controlCalls = [
  [
    'trade_receivables',
    mockReceivablesAccountService.createTradeReceivableSubAccount,
    'Trade Receivables',
    'receivables',
    'trade_receivable',
    '102000',
  ],
  [
    'statutory_receivables',
    mockReceivablesAccountService.createStatutoryReceivableSubAccount,
    'Statutory Receivables',
    'receivables',
    'statutory_receivable',
    '102000',
  ],
  [
    'trade_payables',
    mockPayablesAccountService.createTradePayableSubAccount,
    'Trade Payables',
    'payable',
    'trade_payable',
    '201000',
  ],
  [
    'statutory_payables',
    mockPayablesAccountService.createStatutoryPayableSubAccount,
    'Statutory Payables',
    'payable',
    'tax_payable',
    '201000',
  ],
] as const;
const dependencies = {
  appContext: mockAppContext,
  repoService: mockRepoService,
  eventBus: mockEventBus,
  ledgerAccountPersistenceService: mockLedgerAccountPersistenceService,
  cashAccountService: mockAssetAccountService,
  receivablesAccountService: mockReceivablesAccountService,
  shortTermLoanAccountService: mockShortTermLoanAccountService,
  payablesAccountService: mockPayablesAccountService,
  equityAccountService: mockEquityAccountService,
  servicesAccountService: mockServicesAccountService,
  employmentIncomeAccountService: mockEmploymentIncomeAccountService,
  gainOnAssetSaleAccountService: mockGainOnAssetSaleAccountService,
  unrealizedGainAccountService: mockUnrealizedGainAccountService,
  grantsAccountService: mockGrantsAccountService,
  giftsAccountService: mockGiftsAccountService,
  directCostsAccountService: mockDirectCostsAccountService,
  rentAndUtilitiesAccountService: mockRentAndUtilitiesAccountService,
  bankChargeAccountService: mockBankChargeAccountService,
  financeCostAccountService: mockFinanceCostAccountService,
  interestAccountService: mockInterestAccountService,
  taxExpenseAccountService: mockTaxExpenseAccountService,
  unrealizedLossAccountService: mockUnrealizedLossAccountService,
  assetDisposalLossAccountService: mockAssetDisposalLossAccountService,
};
const usecase = makeSetupHeaderAccountsUsecase(dependencies);

const allocation = makeLedgerCodeAllocationService({
  ledgerAccountRepo: mockLedgerAccountRepo,
});
let storedAccounts: ILedgerAccount[];
let storedHistories: ILedgerAccountHistory[];
let storedBalances: ILedgerAccountBalance[];
let committed: boolean;

describe('setupHeaderAccountsUsecase', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    storedAccounts = [];
    storedHistories = [];
    storedBalances = [];
    committed = false;
    mockAppContext.get.mockReturnValue({
      actor,
      accountingEntity,
      correlationId,
    });
    mockRepoService.createTransaction.mockResolvedValue(mockRepoTransaction);
    mockRepoTransaction.commit.mockImplementation(async () => {
      committed = true;
    });
    mockRepoTransaction.handleError.mockImplementation(async (error) => {
      if (!committed) {
        storedAccounts = [];
        storedHistories = [];
        storedBalances = [];
      }
      throw error;
    });
    mockRepoService.runInTransaction.mockImplementation(
      async (fn, parentTx) => {
        expect(parentTx).toBe(tx);
        return fn(parentTx!);
      }
    );
    mockLedgerAccountRepo.findByCode.mockImplementation(
      async (code, entityId, options) => {
        expect(options.tx).toBe(tx);
        return (
          storedAccounts.find(
            (account) =>
              account.code === code && account.accountingEntityId === entityId
          ) ?? null
        );
      }
    );
    mockLedgerAccountRepo.findById.mockImplementation(
      async (id, entityId, options) => {
        expect(options).toMatchObject({ tx, lock: ERepoLock.Update });
        return (
          storedAccounts.find(
            (account) =>
              account.id === id && account.accountingEntityId === entityId
          ) ?? null
        );
      }
    );
    mockLedgerAccountRepo.findLatestBySubType.mockImplementation(
      async (entityId, type, subType, options) => {
        expect(options.tx).toBe(tx);
        return (
          storedAccounts
            .filter(
              (account) =>
                account.accountingEntityId === entityId &&
                account.type === type &&
                account.subType === subType
            )
            .sort((a, b) => b.code.localeCompare(a.code))[0] ?? null
        );
      }
    );
    mockLedgerAccountPersistenceService.create.mockImplementation(
      async (account, currency, options) => {
        expect(options.tx).toBe(tx);
        if (account.controlAccountId)
          expect(
            storedAccounts.some(
              (parent) => parent.id === account.controlAccountId
            )
          ).toBe(true);
        expect(
          storedAccounts.some((stored) => stored.code === account.code)
        ).toBe(false);
        storedAccounts.push(account);
        storedHistories.push(...options.history);
      }
    );
    mockEventBus.publish.mockImplementation(async () => {
      expect(committed).toBe(true);
    });
    const receivablesService = makeReceivablesAccountService({
      ledgerAccountRepo: mockLedgerAccountRepo,
      ledgerCodeAllocationService: allocation,
    });
    mockReceivablesAccountService.createTradeReceivableSubAccount.mockImplementation(
      receivablesService.createTradeReceivableSubAccount
    );
    mockReceivablesAccountService.createStatutoryReceivableSubAccount.mockImplementation(
      receivablesService.createStatutoryReceivableSubAccount
    );
    const payablesService = makePayablesAccountService({
      ledgerAccountRepo: mockLedgerAccountRepo,
      ledgerCodeAllocationService: allocation,
    });
    mockPayablesAccountService.createTradePayableSubAccount.mockImplementation(
      payablesService.createTradePayableSubAccount
    );
    mockPayablesAccountService.createStatutoryPayableSubAccount.mockImplementation(
      payablesService.createStatutoryPayableSubAccount
    );
    mockEventBus.publish.mockResolvedValue();
    mockAssetAccountService.createHeader.mockImplementation(
      makeCashAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
        bankAccountRepo: mockBankAccountRepo,
        ledgerCodeAllocationService: allocation,
      }).createHeader
    );
    mockReceivablesAccountService.createHeader.mockImplementation(
      makeReceivablesAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
        ledgerCodeAllocationService: allocation,
      }).createHeader
    );
    mockShortTermLoanAccountService.createHeader.mockImplementation(
      makeShortTermLoanService({ ledgerAccountRepo: mockLedgerAccountRepo })
        .createHeader
    );
    mockPayablesAccountService.createHeader.mockImplementation(
      makePayablesAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
        ledgerCodeAllocationService: allocation,
      }).createHeader
    );
    mockEquityAccountService.createRetainedEarningsAccount.mockImplementation(
      makeEquityAccountService({ ledgerAccountRepo: mockLedgerAccountRepo })
        .createRetainedEarningsAccount
    );
    mockEquityAccountService.createOpeningBalanceAccount.mockImplementation(
      makeEquityAccountService({ ledgerAccountRepo: mockLedgerAccountRepo })
        .createOpeningBalanceAccount
    );
    mockServicesAccountService.createHeader.mockImplementation(
      makeServicesAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
        ledgerCodeAllocationService: allocation,
      }).createHeader
    );
    mockEmploymentIncomeAccountService.createHeader.mockImplementation(
      makeEmploymentIncomeAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
        ledgerCodeAllocationService: allocation,
      }).createHeader
    );
    mockGainOnAssetSaleAccountService.createHeader.mockImplementation(
      makeGainOnAssetSaleAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
        ledgerCodeAllocationService: allocation,
      }).createHeader
    );
    mockUnrealizedGainAccountService.createHeader.mockImplementation(
      makeUnrealizedGainAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
        ledgerCodeAllocationService: allocation,
      }).createHeader
    );
    mockGrantsAccountService.createHeader.mockImplementation(
      makeGrantsAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
        ledgerCodeAllocationService: allocation,
      }).createHeader
    );
    mockGiftsAccountService.createHeader.mockImplementation(
      makeGiftsAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
        ledgerCodeAllocationService: allocation,
      }).createHeader
    );
    mockDirectCostsAccountService.createHeader.mockImplementation(
      makeDirectCostsAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
        ledgerCodeAllocationService: allocation,
      }).createHeader
    );
    mockRentAndUtilitiesAccountService.createHeader.mockImplementation(
      makeRentAndUtilitiesAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
        ledgerCodeAllocationService: allocation,
      }).createHeader
    );
    mockBankChargeAccountService.createHeader.mockImplementation(
      makeBankChargeAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
        ledgerCodeAllocationService: allocation,
      }).createHeader
    );
    mockFinanceCostAccountService.createHeader.mockImplementation(
      makeFinanceCostAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
        ledgerCodeAllocationService: allocation,
      }).createHeader
    );
    mockInterestAccountService.createHeader.mockImplementation(
      makeInterestAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
        ledgerCodeAllocationService: allocation,
      }).createHeader
    );
    mockTaxExpenseAccountService.createHeader.mockImplementation(
      makeTaxExpenseAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
        ledgerCodeAllocationService: allocation,
      }).createHeader
    );
    mockUnrealizedLossAccountService.createHeader.mockImplementation(
      makeUnrealizedLossAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
        ledgerCodeAllocationService: allocation,
      }).createHeader
    );
    mockAssetDisposalLossAccountService.createHeader.mockImplementation(
      makeAssetDisposalService({
        ledgerAccountRepo: mockLedgerAccountRepo,
        ledgerCodeAllocationService: allocation,
      }).createHeader
    );
  });
  it.each([undefined, {}])(
    'creates the same 24 default accounts for %j',
    async (aliases) => {
      const result = await usecase(aliases);
      expect(result).toHaveLength(24);
      expect(result.map((account) => account.name)).toEqual(
        [...domainCalls, ...controlCalls].map((entry) => entry[2])
      );
      expect(result.slice(20).map((account) => account.code)).toEqual([
        '102001',
        '102002',
        '201001',
        '201002',
      ]);
      expect(storedAccounts.every((account) => account.version === 1)).toBe(
        true
      );
      expect(storedHistories).toHaveLength(24);
      expect(
        storedHistories.every(
          (history) =>
            history.entityVersion === 1 && history.diff.before === null
        )
      ).toBe(true);
      expect(mockLedgerAccountPersistenceService.create).toHaveBeenCalledTimes(
        24
      );
      expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
      expect(mockRepoTransaction.dispose).toHaveBeenCalledTimes(1);
      expect(mockEventBus.publish.mock.calls[0][0]).toHaveLength(24);
      for (const entry of domainCalls)
        expect(entry[1]).toHaveBeenCalledWith(
          { name: entry[2], accountingEntity, createdBy: actor.id },
          { correlationId, tx }
        );
      for (const account of storedAccounts.slice(20)) {
        const parent = storedAccounts.find(
          (candidate) => candidate.id === account.controlAccountId
        )!;
        expect(account.materializedPath).toBe(
          parent.materializedPath + '.' + account.code
        );
      }
    }
  );
  it('preserves all aliases and response order', async () => {
    const aliases = Object.fromEntries(
      [...domainCalls, ...controlCalls].map((entry) => [
        entry[0],
        'Custom ' + entry[2],
      ])
    ) as IHeaderAccountNameAliasesReq;
    const response = await usecase(aliases);
    expect(response.map((account) => account.name)).toEqual(
      Object.values(aliases)
    );
  });
  it('rejects malformed aliases before acquiring a transaction', async () => {
    await expect(usecase({ receivables: '' })).rejects.toBeInstanceOf(
      appError.UnprocessableEntity
    );
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
  });
  it.each(['header', 'control', 'write', 'commit'] as const)(
    'cleans up after a %s failure without publication',
    async (stage) => {
      const failure = new Error(stage);
      if (stage === 'header')
        mockAssetAccountService.createHeader.mockRejectedValueOnce(failure);
      if (stage === 'control')
        mockPayablesAccountService.createStatutoryPayableSubAccount.mockRejectedValueOnce(
          failure
        );
      if (stage === 'write')
        mockLedgerAccountPersistenceService.create.mockImplementation(
          async (account, currency, options) => {
            storedAccounts.push(account);
            storedHistories.push(...options.history);
            if (storedAccounts.length === 24) throw failure;
          }
        );
      if (stage === 'commit')
        mockRepoTransaction.commit.mockRejectedValueOnce(failure);
      await expect(usecase()).rejects.toBe(failure);
      expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
      expect(mockRepoTransaction.dispose).toHaveBeenCalledTimes(1);
      expect(storedAccounts).toHaveLength(0);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );
  it('keeps committed accounts when publication fails', async () => {
    const failure = new Error('publish');
    mockEventBus.publish.mockRejectedValueOnce(failure);
    await expect(usecase()).rejects.toBe(failure);
    expect(storedAccounts).toHaveLength(24);
    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
  });
  it('composes the real persistence and domain services with transaction-local roots and balances', async () => {
    mockLedgerAccountRepo.create.mockImplementation(
      async (payload, options) => {
        const accounts = Array.isArray(payload) ? payload : [payload];
        for (const account of accounts) {
          if (account.controlAccountId)
            expect(
              storedAccounts.some(
                (parent) => parent.id === account.controlAccountId
              )
            ).toBe(true);
          expect(
            storedAccounts.some((stored) => stored.code === account.code)
          ).toBe(false);
          storedAccounts.push(account);
        }
        storedHistories.push(
          ...(Array.isArray(options.history)
            ? options.history
            : [options.history])
        );
      }
    );
    mockLedgerAccountBalanceRepo.create.mockImplementation(
      async (balance, options) => {
        expect(options.tx).toBe(tx);
        storedBalances.push(balance);
      }
    );
    const persistence = makeLedgerAccountPersistenceService({
      ledgerAccountRepo: mockLedgerAccountRepo,
      ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
      repoService: mockRepoService,
    });
    const setup = makeSetupHeaderAccountsUsecase({
      ...dependencies,
      ledgerAccountPersistenceService: persistence,
    });
    const response = await setup();
    expect(storedAccounts).toHaveLength(24);
    expect(storedBalances).toHaveLength(24);
    expect(storedHistories).toHaveLength(24);
    for (const account of storedAccounts)
      expect(
        storedBalances.find((balance) => balance.ledgerAccountId === account.id)
          ?.accountMaterializedPath
      ).toBe(account.materializedPath);
    expect(response.slice(20).map((account) => account.code)).toEqual([
      '102001',
      '102002',
      '201001',
      '201002',
    ]);
    const recommendations = makeGetRecommendedBootstrapUsecase()();
    expect(recommendations.receivables[0].controlAccountCode).toBe(
      response[21].code
    );
    expect(recommendations.payables[0].controlAccountCode).toBe(
      response[23].code
    );
    await expect(setup()).rejects.toBeInstanceOf(
      ledgerAccountError.HeaderAccountAlreadyExists
    );
    expect(storedAccounts).toHaveLength(24);
  });
});
