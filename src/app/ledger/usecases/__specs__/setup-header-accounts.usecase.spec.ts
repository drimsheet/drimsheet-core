import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import { ITransactionContext } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import {
  EAccountingEntityType,
  IAccountingEntity,
} from '@domain/accounting/types/accounting-entity.types';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
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
  mockLedgerAccountBalanceRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import { IHeaderAccountNameAliasesReq } from '@app/ledger/dtos/header-account/header-account.dto';
import makeLedgerAccountPersistenceService from '@app/ledger/services/ledger-account-persistence.service';
import makeLedgerCodeAssignmentAppService from '@app/ledger/services/ledger-code-assignment.service';
import makeCreateExpenseAccountUsecase from '@app/ledger/usecases/create-expense-account.usecase';
import makeCreateRevenueAccountUsecase from '@app/ledger/usecases/create-revenue-account.usecase';
import makeCreateStatutoryPayableAccountUsecase from '@app/ledger/usecases/create-statutory-payable-account.usecase';
import makeCreateStatutoryReceivableAccountUsecase from '@app/ledger/usecases/create-statutory-receivable-account.usecase';
import makeCreateTradePayableAccountUsecase from '@app/ledger/usecases/create-trade-payable-account.usecase';
import makeCreateTradeReceivableAccountUsecase from '@app/ledger/usecases/create-trade-receivable-account.usecase';
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
    const assignedCounts = new Map<string, number>();
    mockLedgerAccountPersistenceService.createAndAssignCode.mockImplementation(
      async (payload) => {
        const next =
          (assignedCounts.get(payload.allocationHeaderCode) ?? 0) + 1;
        assignedCounts.set(payload.allocationHeaderCode, next);
        const [account, events] = ledgerAccountEntity.updateCode(
          payload.account,
          String(Number(payload.allocationHeaderCode) + next)
        );
        return { account, events };
      }
    );
    const receivablesService = makeReceivablesAccountService({
      ledgerAccountRepo: mockLedgerAccountRepo,
    });
    mockReceivablesAccountService.createTradeReceivableSubAccount.mockImplementation(
      receivablesService.createTradeReceivableSubAccount
    );
    mockReceivablesAccountService.createStatutoryReceivableSubAccount.mockImplementation(
      receivablesService.createStatutoryReceivableSubAccount
    );
    const payablesService = makePayablesAccountService({
      ledgerAccountRepo: mockLedgerAccountRepo,
    });
    mockPayablesAccountService.createTradePayableSubAccount.mockImplementation(
      payablesService.createTradePayableSubAccount
    );
    mockPayablesAccountService.createStatutoryPayableSubAccount.mockImplementation(
      payablesService.createStatutoryPayableSubAccount
    );
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
    'creates 20 headers/equity accounts and four default controls for %j',
    async (aliases) => {
      const result = await usecase(aliases);
      expect(result).toHaveLength(24);
      expect(result.slice(0, 20)).toEqual(
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
      expect(result.slice(20)).toEqual(
        controlCalls.map((entry) =>
          expect.objectContaining({
            name: entry[2],
            subType: entry[3],
            behavior: entry[4],
            isControlAccount: true,
            accountingEntityId: accountingEntity.id,
            createdBy: actor.id,
            balance: { amount: 0, currencyCode: 'NGN', isMinorUnit: true },
            functionalBalance: {
              amount: 0,
              currencyCode: 'NGN',
              isMinorUnit: true,
            },
          })
        )
      );
      for (const entry of controlCalls) {
        expect(entry[1]).toHaveBeenCalledTimes(1);
        expect(entry[1]).toHaveBeenCalledWith(
          expect.objectContaining({
            name: entry[2],
            accountingEntity,
            createdBy: actor.id,
            isControlAccount: true,
            controlAccount: expect.objectContaining({
              code: entry[5],
              accountingEntityId: accountingEntity.id,
            }),
          })
        );
      }
      expect(result.slice(20).map((account) => account.code)).toEqual([
        '102001',
        '102002',
        '201001',
        '201002',
      ]);
      expect(
        mockLedgerAccountPersistenceService.createAndAssignCode.mock.calls.map(
          (entry) => entry[0].account.currency?.code ?? null
        )
      ).toEqual(['NGN', 'NGN', null, 'NGN']);
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
      [...domainCalls, ...controlCalls].map((entry) => [
        entry[0],
        `  Traduit ${entry[0]} 資産  `,
      ])
    );
    const result = await usecase(aliases);
    expect(result.map((account) => account.name)).toEqual(
      [...domainCalls, ...controlCalls].map((entry) =>
        aliases[entry[0]]?.trim()
      )
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
      [...domainCalls, ...controlCalls].map((entry) =>
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
    expect(
      mockLedgerAccountPersistenceService.createAndAssignCode
    ).toHaveBeenCalledTimes(4);
    for (const entry of mockLedgerAccountPersistenceService.createAndAssignCode
      .mock.calls) {
      expect(entry[0].actorId).toBe(actor.id);
      expect(entry[1]).toBe('NGN');
      expect(entry[2]).toMatchObject({
        correlationId,
        tx,
        history: [
          expect.objectContaining({
            entityId: entry[0].account.id,
            entityVersion: 1,
            actorId: actor.id,
            correlationId,
          }),
        ],
      });
    }
    expect(
      mockLedgerAccountPersistenceService.createWithoutAssigningCode.mock
        .invocationCallOrder[19]
    ).toBeLessThan(
      mockLedgerAccountPersistenceService.createAndAssignCode.mock
        .invocationCallOrder[0]
    );
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    const events = mockEventBus.publish.mock.calls[0][0];
    if (!Array.isArray(events)) throw new Error('Expected a batch of events');
    expect(events).toHaveLength(28);
    expect(events.slice(0, 20).map((event) => event.data)).toEqual(
      result
        .slice(0, 20)
        .map((account) =>
          expect.objectContaining({ id: account.id, name: account.name })
        )
    );
    for (let index = 0; index < 4; index++) {
      expect(events[20 + index * 2].data).toMatchObject({
        id: result[20 + index].id,
        version: 1,
      });
      expect(events[21 + index * 2].data).toMatchObject({
        id: result[20 + index].id,
        code: result[20 + index].code,
        version: 2,
      });
    }
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

  it('rejects control preparation before opening a transaction', async () => {
    const error = new ledgerAccountError.InvalidControlAccount();
    mockPayablesAccountService.createStatutoryPayableSubAccount.mockImplementationOnce(
      () => {
        throw error;
      }
    );
    await expect(usecase()).rejects.toBe(error);
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
    expect(
      mockLedgerAccountPersistenceService.createWithoutAssigningCode
    ).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it.each([0, 1, 2, 3])(
    'propagates failure on control %i and stops subsequent writes',
    async (failureIndex) => {
      const error = new Error('assignment failed');
      for (let index = 0; index < failureIndex; index++) {
        mockLedgerAccountPersistenceService.createAndAssignCode.mockImplementationOnce(
          async ({ account }) => ({ account, events: [] })
        );
      }
      mockLedgerAccountPersistenceService.createAndAssignCode.mockRejectedValueOnce(
        error
      );
      await expect(usecase()).rejects.toBe(error);
      expect(
        mockLedgerAccountPersistenceService.createWithoutAssigningCode
      ).toHaveBeenCalledTimes(20);
      expect(
        mockLedgerAccountPersistenceService.createAndAssignCode
      ).toHaveBeenCalledTimes(failureIndex + 1);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );

  it('maps final assigned codes and paths rather than provisional control state', async () => {
    mockLedgerAccountPersistenceService.createAndAssignCode.mockImplementation(
      async (payload) => {
        const [account, events] = ledgerAccountEntity.updateCode(
          payload.account,
          '102099'
        );
        return { account, events };
      }
    );
    const response = await usecase();
    expect(response[20]).toMatchObject({
      code: '102099',
      materializedPath: '102000.102099',
    });
    expect(
      mockLedgerAccountPersistenceService.createAndAssignCode.mock.calls[0][0]
        .account.code
    ).toBe('102001');
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
  it('composes real assignment and persistence with transaction-local state for the complete setup', async () => {
    const storedAccounts: ILedgerAccount[] = [];
    const storedHistories: ILedgerAccountHistory[] = [];
    const storedBalances: ILedgerAccountBalance[] = [];
    let committed = false;
    mockRepoService.runInTransaction.mockImplementation(
      async (fn, parentTx) => {
        if (parentTx) {
          expect(parentTx).toBe(tx);
          return fn(parentTx);
        }
        const result = await fn(tx);
        expect(mockEventBus.publish).not.toHaveBeenCalled();
        committed = true;
        return result;
      }
    );
    mockLedgerAccountRepo.findByCode.mockImplementation(
      async (code, entityId) =>
        storedAccounts.find(
          (account) =>
            account.code === code && account.accountingEntityId === entityId
        ) ?? null
    );
    mockLedgerAccountRepo.findByCodeForUpdate.mockImplementation(
      async (code, entityId, options) => {
        expect(options.tx).toBe(tx);
        const header = storedAccounts.find(
          (account) =>
            account.code === code && account.accountingEntityId === entityId
        );
        expect(header).toBeDefined();
        return header ?? null;
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
    mockLedgerAccountRepo.create.mockImplementation(
      async (payload, options) => {
        expect(options.tx).toBe(tx);
        const accounts = Array.isArray(payload) ? payload : [payload];
        for (const account of accounts) {
          expect(
            storedAccounts.some((stored) => stored.code === account.code)
          ).toBe(false);
          if (account.controlAccountId) {
            expect(
              storedAccounts.some(
                (stored) => stored.id === account.controlAccountId
              )
            ).toBe(true);
          }
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
    mockEventBus.publish.mockImplementation(async () => {
      expect(committed).toBe(true);
    });
    const persistence = makeLedgerAccountPersistenceService({
      ledgerAccountRepo: mockLedgerAccountRepo,
      ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
      repoService: mockRepoService,
      ledgerCodeAssignmentAppService: makeLedgerCodeAssignmentAppService({
        ledgerAccountRepo: mockLedgerAccountRepo,
      }),
    });
    const setup = makeSetupHeaderAccountsUsecase({
      ...dependencies,
      ledgerAccountPersistenceService: persistence,
    });
    const response = await setup();
    expect(response).toHaveLength(24);
    expect(storedAccounts).toHaveLength(24);
    expect(storedBalances).toHaveLength(24);
    expect(storedHistories).toHaveLength(28);
    expect(response.slice(20).map((account) => account.code)).toEqual([
      '102001',
      '102002',
      '201001',
      '201002',
    ]);
    for (const account of storedAccounts.slice(20)) {
      const parent = storedAccounts.find(
        (candidate) => candidate.id === account.controlAccountId
      );
      expect(account.materializedPath).toBe(`${parent?.code}.${account.code}`);
      expect(
        storedBalances.find((balance) => balance.ledgerAccountId === account.id)
      ).toMatchObject({
        accountMaterializedPath: account.materializedPath,
        accountingEntityId: accountingEntity.id,
      });
      const history = storedHistories.filter(
        (entry) => entry.entityId === account.id
      );
      expect(history).toHaveLength(2);
      expect(history[0].entityVersion).toBe(1);
      expect(history[1].entityVersion).toBe(2);
      expect(history[1].diff.before).toEqual(history[0].diff.after);
      expect(history[1].diff.after).toEqual(
        JSON.parse(JSON.stringify(account))
      );
    }
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
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    mockServicesAccountService.createSubAccount.mockImplementation(
      makeServicesAccountService({ ledgerAccountRepo: mockLedgerAccountRepo })
        .createSubAccount
    );
    mockEmploymentIncomeAccountService.createSubAccount.mockImplementation(
      makeEmploymentIncomeAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
      }).createSubAccount
    );
    mockGainOnAssetSaleAccountService.createSubAccount.mockImplementation(
      makeGainOnAssetSaleAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
      }).createSubAccount
    );
    mockUnrealizedGainAccountService.createSubAccount.mockImplementation(
      makeUnrealizedGainAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
      }).createSubAccount
    );
    mockGrantsAccountService.createSubAccount.mockImplementation(
      makeGrantsAccountService({ ledgerAccountRepo: mockLedgerAccountRepo })
        .createSubAccount
    );
    mockGiftsAccountService.createSubAccount.mockImplementation(
      makeGiftsAccountService({ ledgerAccountRepo: mockLedgerAccountRepo })
        .createSubAccount
    );
    mockDirectCostsAccountService.createSubAccount.mockImplementation(
      makeDirectCostsAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
      }).createSubAccount
    );
    mockRentAndUtilitiesAccountService.createSubAccount.mockImplementation(
      makeRentAndUtilitiesAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
      }).createSubAccount
    );
    mockBankChargeAccountService.createSubAccount.mockImplementation(
      makeBankChargeAccountService({ ledgerAccountRepo: mockLedgerAccountRepo })
        .createSubAccount
    );
    mockFinanceCostAccountService.createSubAccount.mockImplementation(
      makeFinanceCostAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
      }).createSubAccount
    );
    mockInterestAccountService.createSubAccount.mockImplementation(
      makeInterestAccountService({ ledgerAccountRepo: mockLedgerAccountRepo })
        .createSubAccount
    );
    mockTaxExpenseAccountService.createSubAccount.mockImplementation(
      makeTaxExpenseAccountService({ ledgerAccountRepo: mockLedgerAccountRepo })
        .createSubAccount
    );
    mockUnrealizedLossAccountService.createSubAccount.mockImplementation(
      makeUnrealizedLossAccountService({
        ledgerAccountRepo: mockLedgerAccountRepo,
      }).createSubAccount
    );
    mockAssetDisposalLossAccountService.createSubAccount.mockImplementation(
      makeAssetDisposalService({ ledgerAccountRepo: mockLedgerAccountRepo })
        .createSubAccount
    );
    const postingDependencies = {
      ...dependencies,
      ledgerAccountRepo: mockLedgerAccountRepo,
      ledgerAccountPersistenceService: persistence,
    };
    const createRevenue = makeCreateRevenueAccountUsecase(postingDependencies);
    const createExpense = makeCreateExpenseAccountUsecase(postingDependencies);
    const createTradeReceivable =
      makeCreateTradeReceivableAccountUsecase(postingDependencies);
    const createStatutoryReceivable =
      makeCreateStatutoryReceivableAccountUsecase(postingDependencies);
    const createTradePayable =
      makeCreateTradePayableAccountUsecase(postingDependencies);
    const createStatutoryPayable =
      makeCreateStatutoryPayableAccountUsecase(postingDependencies);
    const postingRequests = [
      ...recommendations.revenue.map((definition) => ({
        definition,
        create: () =>
          createRevenue({
            name: definition.name,
            isControlAccount: false,
            behavior: definition.behavior as Parameters<
              typeof createRevenue
            >[0]['behavior'],
          }),
      })),
      ...recommendations.expense.map((definition) => ({
        definition,
        create: () =>
          createExpense({
            name: definition.name,
            isControlAccount: false,
            behavior: definition.behavior as Parameters<
              typeof createExpense
            >[0]['behavior'],
          }),
      })),
      ...recommendations.receivables.map((definition) => ({
        definition,
        create: () =>
          createStatutoryReceivable({
            name: definition.name,
            isControlAccount: false,
            currencyCode: 'NGN',
          }),
      })),
      ...recommendations.payables.map((definition) => ({
        definition,
        create: () =>
          createStatutoryPayable({
            name: definition.name,
            isControlAccount: false,
            currencyCode: 'NGN',
          }),
      })),
      {
        definition: {
          name: 'Custom trade receivable',
          behavior: 'trade_receivable',
          subType: 'receivables',
          controlAccountCode: '102001',
        },
        create: () =>
          createTradeReceivable({
            name: 'Custom trade receivable',
            isControlAccount: false,
            currencyCode: 'NGN',
          }),
      },
      {
        definition: {
          name: 'Custom trade payable',
          behavior: 'trade_payable',
          subType: 'payable',
          controlAccountCode: '201001',
        },
        create: () =>
          createTradePayable({
            name: 'Custom trade payable',
            isControlAccount: false,
          }),
      },
    ];
    for (const request of postingRequests) {
      committed = false;
      mockEventBus.publish.mockClear();
      const created = await request.create();
      const parent = storedAccounts.find(
        (account) => account.code === request.definition.controlAccountCode
      );
      expect(parent).toBeDefined();
      expect(created).toMatchObject({
        name: request.definition.name,
        behavior: request.definition.behavior,
        subType: request.definition.subType,
        controlAccountId: parent?.id,
        balance: { amount: 0, currencyCode: 'NGN' },
        functionalBalance: { amount: 0, currencyCode: 'NGN' },
      });
      const stored = storedAccounts.find(
        (account) => account.id === created.id
      );
      const isMonetary =
        created.type === 'asset' || created.behavior === 'tax_payable';
      expect(stored?.currency?.code ?? null).toBe(isMonetary ? 'NGN' : null);
      expect(stored?.code).toBe(created.code);
      expect(
        storedBalances.find((balance) => balance.ledgerAccountId === created.id)
      ).toMatchObject({ accountMaterializedPath: created.materializedPath });
      const histories = storedHistories.filter(
        (history) => history.entityId === created.id
      );
      expect(histories).toHaveLength(2);
      expect(histories[1].diff.after).toEqual(
        JSON.parse(JSON.stringify(stored))
      );
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
      expect(mockEventBus.publish.mock.calls[0][0]).toHaveLength(2);
    }
    expect(storedAccounts).toHaveLength(42);
    expect(storedBalances).toHaveLength(42);
    expect(storedHistories).toHaveLength(64);
  });
});
