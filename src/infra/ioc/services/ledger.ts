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
import ledgerAccountBalanceAdjustmentDomainService from '@domain/ledger/services/ledger-account-balance-adjustment.service';
import makePayablesAccountService from '@domain/ledger/services/liability-account/payables.service';
import makeShortTermLoanService from '@domain/ledger/services/liability-account/short-term-loan.service';
import makeEmploymentIncomeAccountService from '@domain/ledger/services/revenue-account/employment-income.service';
import makeGainOnAssetSaleAccountService from '@domain/ledger/services/revenue-account/gain-on-sale.service';
import makeGiftsAccountService from '@domain/ledger/services/revenue-account/gifts.service';
import makeGrantsAccountService from '@domain/ledger/services/revenue-account/grants.service';
import makeServicesAccountService from '@domain/ledger/services/revenue-account/services.service';
import makeUnrealizedGainAccountService from '@domain/ledger/services/revenue-account/unrealized-gain.service';
import makeSuspenseAccountService from '@domain/ledger/services/suspense-account/suspense-account.service';

import makeLedgerAccountBalanceEnrichmentService from '@app/ledger/services/ledger-account-balance-enrichment.service';
import makeLedgerAccountPersistenceService from '@app/ledger/services/ledger-account-persistence.service';
import makeLedgerBalancePropagationPreparationService from '@app/ledger/services/ledger-balance-propagation-preparation.service';
import makePostingAccountBootstrapService from '@app/ledger/services/posting-account-bootstrap.service';
import makeSuspenseAccountBootstrapService from '@app/ledger/services/suspense-account-bootstrap.service';

import observability from '@infra/observability';
import journalEntryRepos from '@infra/persistence/repos/journal-entry';
import ledgerRepos from '@infra/persistence/repos/ledger';

import { repoService } from './repo';

export const cashAccountService = makeCashAccountService({
  ledgerAccountRepo: ledgerRepos.ledgerAccount,
});

export const receivablesAccountService = makeReceivablesAccountService({
  ledgerAccountRepo: ledgerRepos.ledgerAccount,
});

export const suspenseAccountService = makeSuspenseAccountService({
  ledgerAccountRepo: ledgerRepos.ledgerAccount,
});

export const payablesAccountService = makePayablesAccountService({
  ledgerAccountRepo: ledgerRepos.ledgerAccount,
});

export const shortTermLoanAccountService = makeShortTermLoanService({
  ledgerAccountRepo: ledgerRepos.ledgerAccount,
});

export const equityAccountService = makeEquityAccountService({
  ledgerAccountRepo: ledgerRepos.ledgerAccount,
});

export const servicesAccountService = makeServicesAccountService({
  ledgerAccountRepo: ledgerRepos.ledgerAccount,
});

export const employmentIncomeAccountService =
  makeEmploymentIncomeAccountService({
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
  });

export const gainOnAssetSaleAccountService = makeGainOnAssetSaleAccountService({
  ledgerAccountRepo: ledgerRepos.ledgerAccount,
});

export const unrealizedGainAccountService = makeUnrealizedGainAccountService({
  ledgerAccountRepo: ledgerRepos.ledgerAccount,
});

export const grantsAccountService = makeGrantsAccountService({
  ledgerAccountRepo: ledgerRepos.ledgerAccount,
});

export const giftsAccountService = makeGiftsAccountService({
  ledgerAccountRepo: ledgerRepos.ledgerAccount,
});

export const assetDisposalLossAccountService = makeAssetDisposalService({
  ledgerAccountRepo: ledgerRepos.ledgerAccount,
});

export const bankChargeAccountService = makeBankChargeAccountService({
  ledgerAccountRepo: ledgerRepos.ledgerAccount,
});

export const directCostsAccountService = makeDirectCostsAccountService({
  ledgerAccountRepo: ledgerRepos.ledgerAccount,
});

export const financeCostAccountService = makeFinanceCostAccountService({
  ledgerAccountRepo: ledgerRepos.ledgerAccount,
});

export const interestAccountService = makeInterestAccountService({
  ledgerAccountRepo: ledgerRepos.ledgerAccount,
});

export const rentAndUtilitiesAccountService =
  makeRentAndUtilitiesAccountService({
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
  });

export const taxExpenseAccountService = makeTaxExpenseAccountService({
  ledgerAccountRepo: ledgerRepos.ledgerAccount,
});

export const unrealizedLossAccountService = makeUnrealizedLossAccountService({
  ledgerAccountRepo: ledgerRepos.ledgerAccount,
});

export const ledgerAccountPersistenceService =
  makeLedgerAccountPersistenceService({
    ledgerAccountBalanceRepo: ledgerRepos.ledgerAccountBalance,
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
    repoService,
  });

export const postingAccountBootstrapService =
  makePostingAccountBootstrapService({
    ledgerAccountPersistenceService,
    receivablesAccountService,
    payablesAccountService,
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
  });

export const suspenseAccountBootstrapService =
  makeSuspenseAccountBootstrapService({ suspenseAccountService });

const ledgerAccountBalanceAdjustmentService =
  ledgerAccountBalanceAdjustmentDomainService;

export const ledgerBalancePropagationPreparationService =
  makeLedgerBalancePropagationPreparationService({
    journalEntryRepo: journalEntryRepos.journalEntry,
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
    ledgerAccountBalanceRepo: ledgerRepos.ledgerAccountBalance,
    ledgerAccountBalanceAdjustmentService,
  });

export const ledgerAccountBalanceEnrichmentService =
  makeLedgerAccountBalanceEnrichmentService({
    ledgerAccountBalanceRepo: ledgerRepos.ledgerAccountBalance,
    reporter: observability.reporter,
  });
