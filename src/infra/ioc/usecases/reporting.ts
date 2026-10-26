import makeGetAccountCashFlowUsecase from '@app/reporting/usecases/get-account-cash-flow.usecase';
import makeGetAccountCounterpartyParticipationUsecase from '@app/reporting/usecases/get-account-counterparty-participation.usecase';
import makeGetBalancesByAccountUsecase from '@app/reporting/usecases/get-balances-by-account.usecase';
import makeGetBalancesByBehaviorUsecase from '@app/reporting/usecases/get-balances-by-behavior.usecase';
import makeGetBalancesBySubTypeUsecase from '@app/reporting/usecases/get-balances-by-sub-type.usecase';
import makeGetBalancesByTypeUsecase from '@app/reporting/usecases/get-balances-by-type.usecase';
import makeGetLedgerBalancesByCurrencyUsecase from '@app/reporting/usecases/get-ledger-balances-by-currency.usecase';
import makeGetRevenueExpenseAccountsUsecase from '@app/reporting/usecases/get-revenue-expense-accounts.usecase';
import makeGetRevenueExpenseSummaryUsecase from '@app/reporting/usecases/get-revenue-expense-summary.usecase';

import { makeTracedUseCase } from '@infra/observability/usecase-tracing';
import ledgerRepos from '@infra/persistence/repos/ledger';
import accountCashFlowQueryRepo from '@infra/persistence/repos/reporting/queries/account-cash-flow.query.repo.impl';
import accountCounterpartyParticipationQueryRepo from '@infra/persistence/repos/reporting/queries/account-counterparty-participation.query.repo.impl';
import balanceSeriesQueryRepo from '@infra/persistence/repos/reporting/queries/balance-series.query.repo.impl';
import ledgerBalancesByCurrencyQueryRepo from '@infra/persistence/repos/reporting/queries/ledger-balances-by-currency.query.repo.impl';
import revenueExpenseAccountsQueryRepo from '@infra/persistence/repos/reporting/queries/revenue-expense-accounts.query.repo.impl';
import revenueExpenseSummaryQueryRepo from '@infra/persistence/repos/reporting/queries/revenue-expense-summary.query.repo.impl';
import appContext from '@infra/services/app-context.service';

export const getLedgerBalancesByCurrencyUseCase = makeTracedUseCase(
  'reporting.getLedgerBalancesByCurrencyUseCase',
  makeGetLedgerBalancesByCurrencyUsecase({
    appContext,
    ledgerBalancesByCurrencyQueryRepo,
  })
);

export const getAccountCounterpartyParticipationUseCase = makeTracedUseCase(
  'reporting.getAccountCounterpartyParticipationUseCase',
  makeGetAccountCounterpartyParticipationUsecase({
    appContext,
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
    ledgerAccountBalanceRepo: ledgerRepos.ledgerAccountBalance,
    accountCounterpartyParticipationQueryRepo,
  })
);

export const getRevenueExpenseAccountsUseCase = makeTracedUseCase(
  'reporting.getRevenueExpenseAccountsUseCase',
  makeGetRevenueExpenseAccountsUsecase({
    appContext,
    revenueExpenseAccountsQueryRepo,
  })
);

export const getAccountCashFlowUseCase = makeTracedUseCase(
  'reporting.getAccountCashFlowUseCase',
  makeGetAccountCashFlowUsecase({
    appContext,
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
    accountCashFlowQueryRepo,
  })
);

export const getRevenueExpenseSummaryUseCase = makeTracedUseCase(
  'reporting.getRevenueExpenseSummaryUseCase',
  makeGetRevenueExpenseSummaryUsecase({
    appContext,
    revenueExpenseSummaryQueryRepo,
  })
);

export const getBalancesByTypeUseCase = makeTracedUseCase(
  'reporting.getBalancesByTypeUseCase',
  makeGetBalancesByTypeUsecase({
    appContext,
    balanceSeriesQueryRepo,
  })
);

export const getBalancesBySubTypeUseCase = makeTracedUseCase(
  'reporting.getBalancesBySubTypeUseCase',
  makeGetBalancesBySubTypeUsecase({
    appContext,
    balanceSeriesQueryRepo,
  })
);

export const getBalancesByBehaviorUseCase = makeTracedUseCase(
  'reporting.getBalancesByBehaviorUseCase',
  makeGetBalancesByBehaviorUsecase({
    appContext,
    balanceSeriesQueryRepo,
  })
);

export const getBalancesByAccountUseCase = makeTracedUseCase(
  'reporting.getBalancesByAccountUseCase',
  makeGetBalancesByAccountUsecase({
    appContext,
    balanceSeriesQueryRepo,
    ledgerAccountRepo: ledgerRepos.ledgerAccount,
  })
);
