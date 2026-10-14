import makeGetAccountCashFlowUsecase from '@app/reporting/usecases/get-account-cash-flow.usecase';
import makeGetRevenueExpenseAccountsUsecase from '@app/reporting/usecases/get-revenue-expense-accounts.usecase';
import makeGetRevenueExpenseSummaryUsecase from '@app/reporting/usecases/get-revenue-expense-summary.usecase';

import { makeTracedUseCase } from '@infra/observability/usecase-tracing';
import ledgerRepos from '@infra/persistence/repos/ledger';
import accountCashFlowQueryRepo from '@infra/persistence/repos/reporting/queries/account-cash-flow.query.repo.impl';
import revenueExpenseAccountsQueryRepo from '@infra/persistence/repos/reporting/queries/revenue-expense-accounts.query.repo.impl';
import revenueExpenseSummaryQueryRepo from '@infra/persistence/repos/reporting/queries/revenue-expense-summary.query.repo.impl';
import appContext from '@infra/runtime/app-context';

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
