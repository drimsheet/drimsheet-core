import makeGetAccountCashFlowUsecase from '@app/ledger/usecases/reporting/account-cash-flow/account-cash-flow.usecase';
import makeGetAccountCounterpartyParticipationUsecase from '@app/ledger/usecases/reporting/account-counterparty-participation/account-counterparty-participation.usecase';
import makeGetBalancesByAccountUsecase from '@app/ledger/usecases/reporting/balances-by-account/balances-by-account.usecase';
import makeGetBalancesByBehaviorUsecase from '@app/ledger/usecases/reporting/balances-by-behavior/balances-by-behavior.usecase';
import makeGetBalancesBySubTypeUsecase from '@app/ledger/usecases/reporting/balances-by-sub-type/balances-by-sub-type.usecase';
import makeGetBalancesByTypeUsecase from '@app/ledger/usecases/reporting/balances-by-type/balances-by-type.usecase';
import makeGetLedgerBalancesByCurrencyUsecase from '@app/ledger/usecases/reporting/ledger-balances-by-currency/ledger-balances-by-currency.usecase';
import makeGetRevenueExpenseAccountsUsecase from '@app/ledger/usecases/reporting/revenue-expense-accounts/revenue-expense-accounts.usecase';
import makeGetRevenueExpenseSummaryUsecase from '@app/ledger/usecases/reporting/revenue-expense-summary/revenue-expense-summary.usecase';

import { makeTracedUseCase } from '@infra/observability/usecase-tracing';
import ledgerRepos from '@infra/persistence/repos/ledger';
import accountCashFlowRepoQuery from '@infra/persistence/repos/ledger/queries/account-cash-flow.reporting';
import accountCounterpartyParticipationRepoQuery from '@infra/persistence/repos/ledger/queries/account-counterparty-participation.reporting';
import balanceSeriesRepoQuery from '@infra/persistence/repos/ledger/queries/balance-series.reporting';
import ledgerBalancesByCurrencyRepoQuery from '@infra/persistence/repos/ledger/queries/ledger-balances-by-currency.reporting';
import revenueExpenseAccountsRepoQuery from '@infra/persistence/repos/ledger/queries/revenue-expense-accounts.reporting';
import revenueExpenseSummaryRepoQuery from '@infra/persistence/repos/ledger/queries/revenue-expense-summary.reporting';
import appContext from '@infra/services/app-context.service';

export const getAccountCounterpartyParticipationUseCase = makeTracedUseCase(
  'reporting.getAccountCounterpartyParticipationUseCase',
  makeGetAccountCounterpartyParticipationUsecase({
    appContext,
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
    ledgerAccountBalanceRepo: ledgerRepos.ledgerAccountBalance,
    repoQuery: accountCounterpartyParticipationRepoQuery,
  })
);

export const getLedgerBalancesByCurrencyUseCase = makeTracedUseCase(
  'reporting.getLedgerBalancesByCurrencyUseCase',
  makeGetLedgerBalancesByCurrencyUsecase({
    appContext,
    repoQuery: ledgerBalancesByCurrencyRepoQuery,
  })
);

export const getRevenueExpenseAccountsUseCase = makeTracedUseCase(
  'reporting.getRevenueExpenseAccountsUseCase',
  makeGetRevenueExpenseAccountsUsecase({
    appContext,
    repoQuery: revenueExpenseAccountsRepoQuery,
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

export const getRevenueExpenseSummaryUseCase = makeTracedUseCase(
  'reporting.getRevenueExpenseSummaryUseCase',
  makeGetRevenueExpenseSummaryUsecase({
    appContext,
    repoQuery: revenueExpenseSummaryRepoQuery,
  })
);

export const getBalancesByTypeUseCase = makeTracedUseCase(
  'reporting.getBalancesByTypeUseCase',
  makeGetBalancesByTypeUsecase({
    appContext,
    repoQuery: balanceSeriesRepoQuery,
  })
);

export const getBalancesBySubTypeUseCase = makeTracedUseCase(
  'reporting.getBalancesBySubTypeUseCase',
  makeGetBalancesBySubTypeUsecase({
    appContext,
    repoQuery: balanceSeriesRepoQuery,
  })
);

export const getBalancesByBehaviorUseCase = makeTracedUseCase(
  'reporting.getBalancesByBehaviorUseCase',
  makeGetBalancesByBehaviorUsecase({
    appContext,
    repoQuery: balanceSeriesRepoQuery,
  })
);

export const getBalancesByAccountUseCase = makeTracedUseCase(
  'reporting.getBalancesByAccountUseCase',
  makeGetBalancesByAccountUsecase({
    appContext,
    repoQuery: balanceSeriesRepoQuery,
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
  })
);
