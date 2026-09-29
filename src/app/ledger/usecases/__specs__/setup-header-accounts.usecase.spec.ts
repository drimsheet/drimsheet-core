import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import { ITransactionContext } from '@shared/types/repo.types';
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
import makePayablesAccountService from '@domain/ledger/services/liability-account/payables.service';
import makeShortTermLoanService from '@domain/ledger/services/liability-account/short-term-loan.service';
import makeEmploymentIncomeAccountService from '@domain/ledger/services/revenue-account/employment-income.service';
import makeGainOnAssetSaleAccountService from '@domain/ledger/services/revenue-account/gain-on-sale.service';
import makeGiftsAccountService from '@domain/ledger/services/revenue-account/gifts.service';
import makeGrantsAccountService from '@domain/ledger/services/revenue-account/grants.service';
import makeServicesAccountService from '@domain/ledger/services/revenue-account/services.service';
import makeUnrealizedGainAccountService from '@domain/ledger/services/revenue-account/unrealized-gain.service';
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
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import { IHeaderAccountNameAliasesReq } from '@app/ledger/dtos/header-account/header-account.dto';
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
const tx: ITransactionContext = {};
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
const usecase = makeSetupHeaderAccountsUsecase({
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
});

describe('setupHeaderAccountsUsecase', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      actor,
      accountingEntity,
      correlationId,
    });
    mockLedgerAccountRepo.findByCode.mockResolvedValue(null);
    mockRepoService.runInTransaction.mockImplementation(async (fn) => fn(tx));
    mockLedgerAccountPersistenceService.createWithoutAssigningCode.mockResolvedValue();
    mockEventBus.publish.mockResolvedValue();
    mockAssetAccountService.createHeader.mockImplementation(
      makeCashAccountService({ ledgerAccountRepo: mockLedgerAccountRepo })
        .createHeader
    );
    mockReceivablesAccountService.createHeader.mockImplementation(
      makeReceivablesAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
      }).createHeader
    );
    mockShortTermLoanAccountService.createHeader.mockImplementation(
      makeShortTermLoanService({ ledgerAccountRepo: mockLedgerAccountRepo })
        .createHeader
    );
    mockPayablesAccountService.createHeader.mockImplementation(
      makePayablesAccountService({ ledgerAccountRepo: mockLedgerAccountRepo })
        .createHeader
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
      makeServicesAccountService({ ledgerAccountRepo: mockLedgerAccountRepo })
        .createHeader
    );
    mockEmploymentIncomeAccountService.createHeader.mockImplementation(
      makeEmploymentIncomeAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
      }).createHeader
    );
    mockGainOnAssetSaleAccountService.createHeader.mockImplementation(
      makeGainOnAssetSaleAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
      }).createHeader
    );
    mockUnrealizedGainAccountService.createHeader.mockImplementation(
      makeUnrealizedGainAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
      }).createHeader
    );
    mockGrantsAccountService.createHeader.mockImplementation(
      makeGrantsAccountService({ ledgerAccountRepo: mockLedgerAccountRepo })
        .createHeader
    );
    mockGiftsAccountService.createHeader.mockImplementation(
      makeGiftsAccountService({ ledgerAccountRepo: mockLedgerAccountRepo })
        .createHeader
    );
    mockDirectCostsAccountService.createHeader.mockImplementation(
      makeDirectCostsAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
      }).createHeader
    );
    mockRentAndUtilitiesAccountService.createHeader.mockImplementation(
      makeRentAndUtilitiesAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
      }).createHeader
    );
    mockBankChargeAccountService.createHeader.mockImplementation(
      makeBankChargeAccountService({ ledgerAccountRepo: mockLedgerAccountRepo })
        .createHeader
    );
    mockFinanceCostAccountService.createHeader.mockImplementation(
      makeFinanceCostAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
      }).createHeader
    );
    mockInterestAccountService.createHeader.mockImplementation(
      makeInterestAccountService({ ledgerAccountRepo: mockLedgerAccountRepo })
        .createHeader
    );
    mockTaxExpenseAccountService.createHeader.mockImplementation(
      makeTaxExpenseAccountService({ ledgerAccountRepo: mockLedgerAccountRepo })
        .createHeader
    );
    mockUnrealizedLossAccountService.createHeader.mockImplementation(
      makeUnrealizedLossAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
      }).createHeader
    );
    mockAssetDisposalLossAccountService.createHeader.mockImplementation(
      makeAssetDisposalService({ ledgerAccountRepo: mockLedgerAccountRepo })
        .createHeader
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([undefined, {}])(
    'creates all 20 default header/equity accounts for %j',
    async (aliases) => {
      const result = await usecase(aliases);
      expect(result).toHaveLength(20);
      expect(result).toEqual(
        domainCalls.map((entry) =>
          expect.objectContaining({
            name: entry[2],
            subType: entry[0],
            createdBy: actor.id,
            accountingEntityId: accountingEntity.id,
            balance: { amount: 0, currencyCode: 'NGN', isMinorUnit: true },
            functionalBalance: {
              amount: 0,
              currencyCode: 'NGN',
              isMinorUnit: true,
            },
          })
        )
      );
      for (const entry of domainCalls) {
        expect(entry[1]).toHaveBeenCalledTimes(1);
        expect(entry[1]).toHaveBeenCalledWith(
          { name: entry[2], accountingEntity, createdBy: actor.id },
          repoOptions
        );
      }
      expect(
        result.filter((account) => account.type === 'equity')
      ).toHaveLength(2);
      expect(result.some((account) => account.subType === 'suspense')).toBe(
        false
      );
    }
  );

  it('uses every supplied alias and preserves the domain name sanitization', async () => {
    const aliases: IHeaderAccountNameAliasesReq = Object.fromEntries(
      domainCalls.map((entry) => [entry[0], `  Traduit ${entry[0]} 資産  `])
    );
    const result = await usecase(aliases);
    expect(result.map((account) => account.name)).toEqual(
      domainCalls.map((entry) => aliases[entry[0]]?.trim())
    );
    for (const entry of domainCalls) {
      expect(entry[1]).toHaveBeenCalledWith(
        { name: aliases[entry[0]], accountingEntity, createdBy: actor.id },
        repoOptions
      );
    }
  });

  it('falls back independently when only some translations are supplied', async () => {
    const result = await usecase({
      cash_and_cash_equivalent: 'Trésorerie',
      opening_balance: 'Capital inicial',
    });
    expect(result.map((account) => account.name)).toEqual(
      domainCalls.map((entry) =>
        entry[0] === 'cash_and_cash_equivalent'
          ? 'Trésorerie'
          : entry[0] === 'opening_balance'
            ? 'Capital inicial'
            : entry[2]
      )
    );
  });

  it.each([
    null,
    [],
    { receivables: '' },
    { receivables: null },
    { code: '100000' },
  ])('rejects invalid input before using dependencies: %j', async (aliases) => {
    await expect(
      usecase(aliases as unknown as IHeaderAccountNameAliasesReq)
    ).rejects.toBeInstanceOf(appError.UnprocessableEntity);
    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockAssetAccountService.createHeader).not.toHaveBeenCalled();
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
  });

  it('stops preparation at the first conflict without writing or publishing', async () => {
    const error = new ledgerAccountError.HeaderAccountAlreadyExists();
    mockReceivablesAccountService.createHeader.mockRejectedValueOnce(error);
    await expect(usecase()).rejects.toBe(error);
    expect(mockShortTermLoanAccountService.createHeader).not.toHaveBeenCalled();
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
    expect(
      mockLedgerAccountPersistenceService.createWithoutAssigningCode
    ).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it.each([
    [
      mockEquityAccountService.createRetainedEarningsAccount,
      new ledgerAccountError.RetainedEarningsAccountAlreadyExists(),
    ],
    [
      mockEquityAccountService.createOpeningBalanceAccount,
      new ledgerAccountError.OpeningBalanceAccountAlreadyExists(),
    ],
  ])('preserves an existing equity conflict', async (method, error) => {
    method.mockRejectedValueOnce(error);
    await expect(usecase()).rejects.toBe(error);
    expect(
      mockLedgerAccountPersistenceService.createWithoutAssigningCode
    ).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('writes all accounts and histories through one transaction and publishes afterward', async () => {
    let committed = false;
    mockRepoService.runInTransaction.mockImplementation(async (fn) => {
      expect(mockLedgerAccountRepo.findByCode).toHaveBeenCalledTimes(20);
      const result = await fn(tx);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
      committed = true;
      return result;
    });
    mockEventBus.publish.mockImplementation(async () => {
      expect(committed).toBe(true);
    });
    const result = await usecase();
    expect(mockRepoService.runInTransaction).toHaveBeenCalledTimes(1);
    expect(
      mockLedgerAccountPersistenceService.createWithoutAssigningCode
    ).toHaveBeenCalledTimes(20);
    for (const entry of mockLedgerAccountPersistenceService
      .createWithoutAssigningCode.mock.calls) {
      expect(entry[1]).toBe('NGN');
      expect(entry[2]).toEqual({
        correlationId,
        tx,
        history: [
          expect.objectContaining({
            entityId: entry[0].id,
            entityVersion: 1,
            actorId: actor.id,
            correlationId,
            diff: {
              before: null,
              after: expect.objectContaining({
                name: entry[0].name,
                code: entry[0].code,
              }),
            },
          }),
        ],
      });
    }
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    const events = mockEventBus.publish.mock.calls[0][0];
    if (!Array.isArray(events)) throw new Error('Expected a batch of events');
    expect(events).toHaveLength(20);
    expect(events.map((event) => event.data)).toEqual(
      result.map((account) =>
        expect.objectContaining({ id: account.id, name: account.name })
      )
    );
    expect(events.every((event) => event.correlationId === correlationId)).toBe(
      true
    );
    expect(mockAppContext.set).not.toHaveBeenCalled();
  });

  it('propagates write failure and stops subsequent writes without publishing', async () => {
    const error = new Error('write failed');
    mockLedgerAccountPersistenceService.createWithoutAssigningCode
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(error);
    await expect(usecase()).rejects.toBe(error);
    expect(
      mockLedgerAccountPersistenceService.createWithoutAssigningCode
    ).toHaveBeenCalledTimes(2);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('does not publish when transaction commit fails', async () => {
    const error = new Error('commit failed');
    mockRepoService.runInTransaction.mockImplementation(async (fn) => {
      await fn(tx);
      throw error;
    });
    await expect(usecase()).rejects.toBe(error);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('awaits publication and propagates its failure after commit', async () => {
    const error = new Error('publication failed');
    mockEventBus.publish.mockRejectedValueOnce(error);
    await expect(usecase()).rejects.toBe(error);
    expect(
      mockLedgerAccountPersistenceService.createWithoutAssigningCode
    ).toHaveBeenCalledTimes(20);
    expect(mockRepoService.runInTransaction).toHaveBeenCalledTimes(1);
  });
});
