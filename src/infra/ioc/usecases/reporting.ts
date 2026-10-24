import makeGetAccountCashFlowUsecase from '@app/reporting/usecases/get-account-cash-flow.usecase';
import makeGetAccountCounterpartyParticipationUsecase from '@app/reporting/usecases/get-account-counterparty-participation.usecase';
import makeGetAssetLiabilityAccountParticipationUsecase from '@app/reporting/usecases/get-asset-liability-account-participation.usecase';
import makeGetAssetLiabilitySummaryUsecase from '@app/reporting/usecases/get-asset-liability-summary.usecase';
import makeGetLedgerBalancesByCurrencyUsecase from '@app/reporting/usecases/get-ledger-balances-by-currency.usecase';
import makeGetRevenueExpenseAccountsUsecase from '@app/reporting/usecases/get-revenue-expense-accounts.usecase';
import makeGetRevenueExpenseSummaryUsecase from '@app/reporting/usecases/get-revenue-expense-summary.usecase';

import { makeTracedUseCase } from '@infra/observability/usecase-tracing';
import ledgerRepos from '@infra/persistence/repos/ledger';
import accountCashFlowQueryRepo from '@infra/persistence/repos/reporting/queries/account-cash-flow.query.repo.impl';
import accountCounterpartyParticipationQueryRepo from '@infra/persistence/repos/reporting/queries/account-counterparty-participation.query.repo.impl';
import assetLiabilityAccountParticipationQueryRepo from '@infra/persistence/repos/reporting/queries/asset-liability-account-participation.query.repo.impl';
import assetLiabilitySummaryQueryRepo from '@infra/persistence/repos/reporting/queries/asset-liability-summary.query.repo.impl';
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

export const getAssetLiabilityAccountParticipationUseCase = makeTracedUseCase(
  'reporting.getAssetLiabilityAccountParticipationUseCase',
  makeGetAssetLiabilityAccountParticipationUsecase({
    appContext,
    assetLiabilityAccountParticipationQueryRepo,
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

export const getAssetLiabilitySummaryUseCase = makeTracedUseCase(
  'reporting.getAssetLiabilitySummaryUseCase',
  makeGetAssetLiabilitySummaryUsecase({
    appContext,
    assetLiabilitySummaryQueryRepo,
  })
);
