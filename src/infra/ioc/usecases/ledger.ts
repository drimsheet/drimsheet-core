import makeAdjustLedgerAccountBalanceUseCase from '@app/ledger/usecases/adjust-ledger-account-balance.usecase';
import makeArchiveLedgerAccountUsecase from '@app/ledger/usecases/archive-ledger-account.usecase';
import makeCreateBankAccountUseCase from '@app/ledger/usecases/create-bank-account.usecase';
import makeCreateExpenseAccountUsecase from '@app/ledger/usecases/create-expense-account.usecase';
import makeCreatePettyCashAccountUseCase from '@app/ledger/usecases/create-petty-cash-account.usecase';
import makeCreateRevenueAccountUsecase from '@app/ledger/usecases/create-revenue-account.usecase';
import makeCreateStatutoryPayableAccountUsecase from '@app/ledger/usecases/create-statutory-payable-account.usecase';
import makeCreateStatutoryReceivableAccountUsecase from '@app/ledger/usecases/create-statutory-receivable-account.usecase';
import makeCreateSuspenseAccountUsecase from '@app/ledger/usecases/create-suspense-account.usecase';
import makeCreateTradePayableAccountUsecase from '@app/ledger/usecases/create-trade-payable-account.usecase';
import makeCreateTradeReceivableAccountUsecase from '@app/ledger/usecases/create-trade-receivable-account.usecase';
import makeGetAccountTransactionsUseCase from '@app/ledger/usecases/get-account-transactions.usecase';
import makeGetBanksUseCase from '@app/ledger/usecases/get-banks.usecase';
import makeGetLedgerAccountUseCase from '@app/ledger/usecases/get-ledger-account.usecase';
import makeGetLedgerAccountsUsecase from '@app/ledger/usecases/get-ledger-accounts.usecase';
import makeGetPermittedPostingAccountsUsecase from '@app/ledger/usecases/get-permitted-posting-accounts.usecase';
import makeGetRecommendedBootstrapUsecase from '@app/ledger/usecases/get-recommended-bootstrap.usecase';
import makeSetupHeaderAccountsUsecase from '@app/ledger/usecases/setup-header-accounts.usecase';
import makeUpdatePettyCashAccountUseCase from '@app/ledger/usecases/update-petty-cash-account.usecase';

import {
  fxCostBasisPersistenceService,
  fxLotAppService,
} from '@infra/ioc/services/fx-lot-cost-basis';
import {
  journalEntryPersistenceService,
  openingBalanceEntryAppService,
} from '@infra/ioc/services/journal-entry';
import {
  assetDisposalLossAccountService,
  bankChargeAccountService,
  cashAccountService,
  directCostsAccountService,
  employmentIncomeAccountService,
  equityAccountService,
  financeCostAccountService,
  gainOnAssetSaleAccountService,
  giftsAccountService,
  grantsAccountService,
  interestAccountService,
  ledgerAccountArchiveService,
  ledgerAccountBalanceEnrichmentService,
  ledgerAccountPersistenceService,
  ledgerBalancePropagationPreparationService,
  payablesAccountService,
  receivablesAccountService,
  rentAndUtilitiesAccountService,
  servicesAccountService,
  shortTermLoanAccountService,
  suspenseAccountService,
  taxExpenseAccountService,
  unrealizedGainAccountService,
  unrealizedLossAccountService,
} from '@infra/ioc/services/ledger';
import outboxService from '@infra/ioc/services/outbox';
import { repoService } from '@infra/ioc/services/repo';
import messaging from '@infra/messaging';
import observability from '@infra/observability';
import { makeTracedUseCase } from '@infra/observability/usecase-tracing';
import accountingRepos from '@infra/persistence/repos/accounting';
import ledgerRepos from '@infra/persistence/repos/ledger';
import outboxRepo from '@infra/persistence/repos/outbox';
import appContext from '@infra/runtime/app-context';

export const getBanksUseCase = makeTracedUseCase(
  'ledger.getBanksUseCase',
  makeGetBanksUseCase()
);

export const archiveLedgerAccountUseCase = makeTracedUseCase(
  'ledger.archiveLedgerAccountUseCase',
  makeArchiveLedgerAccountUsecase({
    appContext,
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
    archiveService: ledgerAccountArchiveService,
    repoService,
    eventBus: messaging.eventBus,
  })
);

export const getRecommendedBootstrapUseCase = makeTracedUseCase(
  'ledger.getRecommendedBootstrapUseCase',
  makeGetRecommendedBootstrapUsecase()
);

export const getLedgerAccountsUseCase = makeTracedUseCase(
  'ledger.getLedgerAccountsUseCase',
  makeGetLedgerAccountsUsecase({
    appContext: appContext,
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
    balanceEnrichmentService: ledgerAccountBalanceEnrichmentService,
  })
);

export const getPermittedPostingAccountsUseCase = makeTracedUseCase(
  'ledger.getPermittedPostingAccountsUseCase',
  makeGetPermittedPostingAccountsUsecase({
    appContext,
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
    balanceEnrichmentService: ledgerAccountBalanceEnrichmentService,
  })
);

export const getLedgerAccountUseCase = makeTracedUseCase(
  'ledger.getLedgerAccountUseCase',
  makeGetLedgerAccountUseCase({
    appContext: appContext,
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
    balanceEnrichmentService: ledgerAccountBalanceEnrichmentService,
  })
);

export const adjustLedgerAccountBalanceUseCase = makeTracedUseCase(
  'ledger.adjustLedgerAccountBalanceUseCase',
  makeAdjustLedgerAccountBalanceUseCase({
    repoService,
    outboxRepo,
    ledgerAccountBalanceRepo: ledgerRepos.ledgerAccountBalance,
    balancePropagationPreparationService:
      ledgerBalancePropagationPreparationService,
    reporter: observability.reporter,
  })
);

export const getAccountTransactionsUseCase = makeTracedUseCase(
  'ledger.getAccountTransactionsUseCase',
  makeGetAccountTransactionsUseCase({
    appContext: appContext,
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
    accountTransactionQueryRepo: ledgerRepos.queries.accountTransaction,
  })
);

export const createPettyCashAccountUseCase = makeTracedUseCase(
  'ledger.createPettyCashAccountUseCase',
  makeCreatePettyCashAccountUseCase({
    appContext: appContext,
    eventBus: messaging.eventBus,
    cashAccountService,
    openingBalanceEntryAppService,
    journalEntryPersistenceService,
    outboxService,
    ledgerBalanceAdjustmentQueue: messaging.queues.ledgerBalanceAdjustment,
    repoService,
    ledgerAccountPersistenceService,
    fxLotAppService,
    fxCostBasisPersistenceService,
  })
);

export const updatePettyCashAccountUseCase = makeTracedUseCase(
  'ledger.updatePettyCashAccountUseCase',
  makeUpdatePettyCashAccountUseCase({
    appContext,
    eventBus: messaging.eventBus,
    repoService,
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
    cashAccountService,
    openingBalanceEntryAppService,
    journalEntryPersistenceService,
    balanceEnrichmentService: ledgerAccountBalanceEnrichmentService,
    fxCostBasisPersistenceService,
    outboxService,
    ledgerBalanceAdjustmentQueue: messaging.queues.ledgerBalanceAdjustment,
  })
);

export const createBankAccountUseCase = makeTracedUseCase(
  'ledger.createBankAccountUseCase',
  makeCreateBankAccountUseCase({
    appContext: appContext,
    eventBus: messaging.eventBus,
    cashAccountService,
    bankAccountRepo: ledgerRepos.bankAccount,
    openingBalanceEntryAppService,
    journalEntryPersistenceService,
    outboxService,
    ledgerBalanceAdjustmentQueue: messaging.queues.ledgerBalanceAdjustment,
    repoService,
    ledgerAccountPersistenceService,
    fxLotAppService,
    fxCostBasisPersistenceService,
  })
);

export const setupHeaderAccountsUseCase = makeTracedUseCase(
  'ledger.setupHeaderAccountsUseCase',
  makeSetupHeaderAccountsUsecase({
    appContext,
    eventBus: messaging.eventBus,
    repoService,
    ledgerAccountPersistenceService,
    cashAccountService,
    receivablesAccountService,
    shortTermLoanAccountService,
    payablesAccountService,
    equityAccountService,
    servicesAccountService,
    employmentIncomeAccountService,
    gainOnAssetSaleAccountService,
    unrealizedGainAccountService,
    grantsAccountService,
    giftsAccountService,
    directCostsAccountService,
    rentAndUtilitiesAccountService,
    bankChargeAccountService,
    financeCostAccountService,
    interestAccountService,
    taxExpenseAccountService,
    unrealizedLossAccountService,
    assetDisposalLossAccountService,
  })
);

export const createRevenueAccountUseCase = makeTracedUseCase(
  'ledger.createRevenueAccountUseCase',
  makeCreateRevenueAccountUsecase({
    appContext,
    eventBus: messaging.eventBus,
    repoService,
    ledgerAccountPersistenceService,
    servicesAccountService,
    employmentIncomeAccountService,
    gainOnAssetSaleAccountService,
    unrealizedGainAccountService,
    grantsAccountService,
    giftsAccountService,
  })
);

export const createExpenseAccountUseCase = makeTracedUseCase(
  'ledger.createExpenseAccountUseCase',
  makeCreateExpenseAccountUsecase({
    appContext,
    eventBus: messaging.eventBus,
    repoService,
    ledgerAccountPersistenceService,
    directCostsAccountService,
    rentAndUtilitiesAccountService,
    bankChargeAccountService,
    financeCostAccountService,
    interestAccountService,
    taxExpenseAccountService,
    unrealizedLossAccountService,
    assetDisposalLossAccountService,
  })
);

export const createTradeReceivableAccountUseCase = makeTracedUseCase(
  'ledger.createTradeReceivableAccountUseCase',
  makeCreateTradeReceivableAccountUsecase({
    appContext,
    eventBus: messaging.eventBus,
    repoService,
    ledgerAccountPersistenceService,
    receivablesAccountService,
  })
);

export const createStatutoryReceivableAccountUseCase = makeTracedUseCase(
  'ledger.createStatutoryReceivableAccountUseCase',
  makeCreateStatutoryReceivableAccountUsecase({
    appContext,
    eventBus: messaging.eventBus,
    repoService,
    ledgerAccountPersistenceService,
    receivablesAccountService,
  })
);

export const createTradePayableAccountUseCase = makeTracedUseCase(
  'ledger.createTradePayableAccountUseCase',
  makeCreateTradePayableAccountUsecase({
    appContext,
    eventBus: messaging.eventBus,
    repoService,
    ledgerAccountPersistenceService,
    payablesAccountService,
  })
);

export const createStatutoryPayableAccountUseCase = makeTracedUseCase(
  'ledger.createStatutoryPayableAccountUseCase',
  makeCreateStatutoryPayableAccountUsecase({
    appContext,
    eventBus: messaging.eventBus,
    repoService,
    ledgerAccountPersistenceService,
    payablesAccountService,
  })
);

export const createSuspenseAccountUseCase = makeTracedUseCase(
  'ledger.createSuspenseAccountUseCase',
  makeCreateSuspenseAccountUsecase({
    appContext,
    eventBus: messaging.eventBus,
    repoService,
    accountingEntityRepo: accountingRepos.accountingEntity,
    suspenseAccountService,
    ledgerAccountPersistenceService,
  })
);
