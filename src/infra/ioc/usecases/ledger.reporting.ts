import makeGetAccountBalanceContributionsByCounterpartyUsecase from '@app/ledger/usecases/reporting/account-balance-contributions-by-counterparty/account-balance-contributions-by-counterparty.usecase';
import makeGetAccountCashFlowUsecase from '@app/ledger/usecases/reporting/account-cash-flow/account-cash-flow.usecase';
import makeGetBalanceHistoryByAccountUsecase from '@app/ledger/usecases/reporting/balance-history-by-account/balance-history-by-account.usecase';
import makeGetBalanceHistoryByBehaviorUsecase from '@app/ledger/usecases/reporting/balance-history-by-behavior/balance-history-by-behavior.usecase';
import makeGetBalanceHistoryBySubTypeUsecase from '@app/ledger/usecases/reporting/balance-history-by-sub-type/balance-history-by-sub-type.usecase';
import makeGetBalanceHistoryByTypeUsecase from '@app/ledger/usecases/reporting/balance-history-by-type/balance-history-by-type.usecase';
import makeGetCurrentAssetAndLiabilityBalancesByCurrencyUsecase from '@app/ledger/usecases/reporting/current-asset-and-liability-balances-by-currency/current-asset-and-liability-balances-by-currency.usecase';
import makeGetCurrentTotalBalanceByTypeUsecase from '@app/ledger/usecases/reporting/current-total-balance-by-type/current-total-balance-by-type.usecase';
import makeGetLedgerTotalDebitsAndCreditsByCurrencyUsecase from '@app/ledger/usecases/reporting/ledger-total-debits-and-credits-by-currency/ledger-total-debits-and-credits-by-currency.usecase';
import makeGetRevenueAndExpenseActivitySummaryUsecase from '@app/ledger/usecases/reporting/revenue-and-expense-activity-summary/revenue-and-expense-activity-summary.usecase';
import makeGetRevenueExpenseAndSuspenseAccountBalancesUsecase from '@app/ledger/usecases/reporting/revenue-expense-and-suspense-account-balances/revenue-expense-and-suspense-account-balances.usecase';

import { makeTracedUseCase } from '@infra/observability/usecase-tracing';
import accountingRepos from '@infra/persistence/repos/accounting';
import ledgerRepos from '@infra/persistence/repos/ledger';
import accountBalanceContributionsByCounterpartyRepoQuery from '@infra/persistence/repos/ledger/queries/account-balance-contributions-by-counterparty.reporting';
import accountCashFlowRepoQuery from '@infra/persistence/repos/ledger/queries/account-cash-flow.reporting';
import balanceHistoryRepoQuery from '@infra/persistence/repos/ledger/queries/balance-history.reporting';
import currentAssetAndLiabilityBalancesByCurrencyRepoQuery from '@infra/persistence/repos/ledger/queries/current-asset-and-liability-balances-by-currency.reporting';
import currentTotalBalanceByTypeRepoQuery from '@infra/persistence/repos/ledger/queries/current-total-balance-by-type.reporting';
import ledgerTotalDebitsAndCreditsByCurrencyRepoQuery from '@infra/persistence/repos/ledger/queries/ledger-total-debits-and-credits-by-currency.reporting';
import revenueAndExpenseActivitySummaryRepoQuery from '@infra/persistence/repos/ledger/queries/revenue-and-expense-activity-summary.reporting';
import revenueExpenseAndSuspenseAccountBalancesRepoQuery from '@infra/persistence/repos/ledger/queries/revenue-expense-and-suspense-account-balances.reporting';
import appContext from '@infra/services/app-context.service';

export const getAccountBalanceContributionsByCounterpartyUseCase =
  makeTracedUseCase(
    'reporting.getAccountBalanceContributionsByCounterpartyUseCase',
    makeGetAccountBalanceContributionsByCounterpartyUsecase({
      appContext,
      ledgerAccountRepo: ledgerRepos.ledgerAccount,
      ledgerAccountBalanceRepo: ledgerRepos.ledgerAccountBalance,
      repoQuery: accountBalanceContributionsByCounterpartyRepoQuery,
    })
  );

export const getCurrentAssetAndLiabilityBalancesByCurrencyUseCase =
  makeTracedUseCase(
    'reporting.getCurrentAssetAndLiabilityBalancesByCurrencyUseCase',
    makeGetCurrentAssetAndLiabilityBalancesByCurrencyUsecase({
      appContext,
      repoQuery: currentAssetAndLiabilityBalancesByCurrencyRepoQuery,
    })
  );

export const getRevenueExpenseAndSuspenseAccountBalancesUseCase =
  makeTracedUseCase(
    'reporting.getRevenueExpenseAndSuspenseAccountBalancesUseCase',
    makeGetRevenueExpenseAndSuspenseAccountBalancesUsecase({
      appContext,
      repoQuery: revenueExpenseAndSuspenseAccountBalancesRepoQuery,
    })
  );

export const getAccountCashFlowUseCase = makeTracedUseCase(
  'reporting.getAccountCashFlowUseCase',
  makeGetAccountCashFlowUsecase({
    appContext,
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
    repoQuery: accountCashFlowRepoQuery,
  })
);

export const getRevenueAndExpenseActivitySummaryUseCase = makeTracedUseCase(
  'reporting.getRevenueAndExpenseActivitySummaryUseCase',
  makeGetRevenueAndExpenseActivitySummaryUsecase({
    appContext,
    repoQuery: revenueAndExpenseActivitySummaryRepoQuery,
  })
);

export const getBalanceHistoryByTypeUseCase = makeTracedUseCase(
  'reporting.getBalanceHistoryByTypeUseCase',
  makeGetBalanceHistoryByTypeUsecase({
    appContext,
    repoQuery: balanceHistoryRepoQuery,
  })
);

export const getBalanceHistoryBySubTypeUseCase = makeTracedUseCase(
  'reporting.getBalanceHistoryBySubTypeUseCase',
  makeGetBalanceHistoryBySubTypeUsecase({
    appContext,
    repoQuery: balanceHistoryRepoQuery,
  })
);

export const getBalanceHistoryByBehaviorUseCase = makeTracedUseCase(
  'reporting.getBalanceHistoryByBehaviorUseCase',
  makeGetBalanceHistoryByBehaviorUsecase({
    appContext,
    repoQuery: balanceHistoryRepoQuery,
  })
);

export const getBalanceHistoryByAccountUseCase = makeTracedUseCase(
  'reporting.getBalanceHistoryByAccountUseCase',
  makeGetBalanceHistoryByAccountUsecase({
    appContext,
    repoQuery: balanceHistoryRepoQuery,
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
  })
);

export const getLedgerTotalDebitsAndCreditsByCurrencyUseCase =
  makeTracedUseCase(
    'reporting.getLedgerTotalDebitsAndCreditsByCurrencyUseCase',
    makeGetLedgerTotalDebitsAndCreditsByCurrencyUsecase({
      appContext,
      fiscalYearRepo: accountingRepos.fiscalYear,
      repoQuery: ledgerTotalDebitsAndCreditsByCurrencyRepoQuery,
    })
  );

export const getCurrentTotalBalanceByTypeUseCase = makeTracedUseCase(
  'reporting.getCurrentTotalBalanceByTypeUseCase',
  makeGetCurrentTotalBalanceByTypeUsecase({
    appContext,
    repoQuery: currentTotalBalanceByTypeRepoQuery,
  })
);
