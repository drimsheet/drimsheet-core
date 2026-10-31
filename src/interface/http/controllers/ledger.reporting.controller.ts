import {
  Controller,
  Get,
  Middlewares,
  OperationId,
  Path,
  Queries,
  Response,
  Route,
  SuccessResponse,
  Tags,
} from 'tsoa';

import { IHttpErrorDto } from '@shared/values/errors/error.dto';

import type { IGetAccountActivityByTypesQuery } from '@app/ledger/usecases/reporting/account-activity-by-types/dto';
import type { IGetAccountActivityQuery } from '@app/ledger/usecases/reporting/account-activity/dto';
import type { IGetAccountBalanceContributionsByCounterpartyQuery } from '@app/ledger/usecases/reporting/account-balance-contributions-by-counterparty/dto';
import type { IGetAccountCashFlowQuery } from '@app/ledger/usecases/reporting/account-cash-flow/dto';
import type { IGetBalanceHistoryByAccountQuery } from '@app/ledger/usecases/reporting/balance-history-by-account/dto';
import type { IGetBalanceHistoryByBehaviorQuery } from '@app/ledger/usecases/reporting/balance-history-by-behavior/dto';
import type { IGetBalanceHistoryBySubTypeQuery } from '@app/ledger/usecases/reporting/balance-history-by-sub-type/dto';
import type { IGetBalanceHistoryByTypeQuery } from '@app/ledger/usecases/reporting/balance-history-by-type/dto';
import type { IGetCurrentAssetAndLiabilityBalancesByCurrencyQuery } from '@app/ledger/usecases/reporting/current-asset-and-liability-balances-by-currency/dto';
import type { IGetCurrentTotalBalanceByTypeQuery } from '@app/ledger/usecases/reporting/current-total-balance-by-type/dto';
import type { IGetLedgerTotalDebitsAndCreditsByCurrencyQuery } from '@app/ledger/usecases/reporting/ledger-total-debits-and-credits-by-currency/dto';
import type { IGetRevenueExpenseAndSuspenseAccountBalancesQuery } from '@app/ledger/usecases/reporting/revenue-expense-and-suspense-account-balances/dto';
import type { IDateRangeDto } from '@app/ledger/usecases/reporting/shared/date-range';

import middlewares from '@infra/ioc/middlewares/http';
import {
  getAccountActivityByTypesUseCase,
  getAccountActivityUseCase,
  getAccountBalanceContributionsByCounterpartyUseCase,
  getAccountCashFlowUseCase,
  getBalanceHistoryByAccountUseCase,
  getBalanceHistoryByBehaviorUseCase,
  getBalanceHistoryBySubTypeUseCase,
  getBalanceHistoryByTypeUseCase,
  getCurrentAssetAndLiabilityBalancesByCurrencyUseCase,
  getCurrentTotalBalanceByTypeUseCase,
  getLedgerTotalDebitsAndCreditsByCurrencyUseCase,
  getRevenueAndExpenseActivitySummaryUseCase,
  getRevenueExpenseAndSuspenseAccountBalancesUseCase,
} from '@infra/ioc/usecases/ledger.reporting';

@Route('reporting/ledger')
@Tags('Reporting', 'Ledger Reporting')
export class LedgerReportingController extends Controller {
  /**
   * Returns activity by type in functional currency with signed normal-side
   * deltas. Dates are inclusive, up to 366 days; empty buckets return zeros.
   * Opening balances and reversed activity are excluded.
   */
  @Get('/account-activity-by-types')
  @OperationId('getAccountActivityByTypes')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async getAccountActivityByTypes(
    @Queries() query: IGetAccountActivityByTypesQuery
  ) {
    return await getAccountActivityByTypesUseCase(query);
  }

  /**
   * Returns activity for an account and its descendants in functional currency.
   * Deltas follow the selected account's normal side. Dates are inclusive, up
   * to 366 days; empty buckets return zeros. Opening balances and reversed
   * activity are excluded.
   */
  @Get('/accounts/{accountId}/activity')
  @OperationId('getAccountActivity')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async getAccountActivity(
    @Path() accountId: string,
    @Queries() query: IGetAccountActivityQuery
  ) {
    return await getAccountActivityUseCase(accountId, query);
  }

  /**
   * Returns counterparty contributions to an account balance, including
   * descendants. Optional from/to dates filter effective dates inclusively;
   * either bound may be omitted. Shares use period net activity when dates are
   * supplied, otherwise the stored balance, before search and pagination.
   * Zero denominators yield null. Self and unattributed groups stay separate.
   */
  @Get('/accounts/{accountId}/balance-contributions-by-counterparty')
  @OperationId('getAccountBalanceContributionsByCounterparty')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async getAccountBalanceContributionsByCounterparty(
    @Path() accountId: string,
    @Queries() query: IGetAccountBalanceContributionsByCounterpartyQuery
  ) {
    return await getAccountBalanceContributionsByCounterpartyUseCase(
      accountId,
      query
    );
  }

  /**
   * Returns daily money in and out for a bank or petty-cash posting account
   * in its own currency. Dates are inclusive, up to 366 days; empty days
   * return zero flows. Opening balances and reversed activity are excluded.
   */
  @Get('/accounts/{accountId}/cash-flow')
  @OperationId('getAccountCashFlow')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async getAccountCashFlow(
    @Path() accountId: string,
    @Queries() query: IGetAccountCashFlowQuery
  ) {
    return await getAccountCashFlowUseCase(accountId, query);
  }

  /**
   * Returns closing-balance series for selected accounts and their descendants
   * in functional currency. Each account forms an independent series.
   * Dates are inclusive, up to 366 days; balances carry across empty buckets.
   */
  @Get('/balance-history-by-account')
  @OperationId('getBalanceHistoryByAccount')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async getBalanceHistoryByAccount(
    @Queries() query: IGetBalanceHistoryByAccountQuery
  ) {
    return await getBalanceHistoryByAccountUseCase(query);
  }

  /**
   * Returns closing-balance series grouped by account behavior in functional
   * currency, including descendant activity. Dates are inclusive, up to
   * 366 days; balances carry across empty buckets.
   */
  @Get('/balance-history-by-behavior')
  @OperationId('getBalanceHistoryByBehavior')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async getBalanceHistoryByBehavior(
    @Queries() query: IGetBalanceHistoryByBehaviorQuery
  ) {
    return await getBalanceHistoryByBehaviorUseCase(query);
  }

  /**
   * Returns closing-balance series grouped by account sub-type in functional
   * currency, including descendant activity. Dates are inclusive, up to
   * 366 days; balances carry across empty buckets.
   */
  @Get('/balance-history-by-sub-type')
  @OperationId('getBalanceHistoryBySubType')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async getBalanceHistoryBySubType(
    @Queries() query: IGetBalanceHistoryBySubTypeQuery
  ) {
    return await getBalanceHistoryBySubTypeUseCase(query);
  }

  /**
   * Returns closing-balance series grouped by account type in functional
   * currency, including descendant activity. Dates are inclusive, up to
   * 366 days; balances carry across empty buckets.
   */
  @Get('/balance-history-by-type')
  @OperationId('getBalanceHistoryByType')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async getBalanceHistoryByType(
    @Queries() query: IGetBalanceHistoryByTypeQuery
  ) {
    return await getBalanceHistoryByTypeUseCase(query);
  }

  /**
   * Returns current asset or liability posting balances grouped by currency,
   * with recorded functional balances and a combined functional total.
   * Accounts without a fixed currency use functional currency. Stored
   * balances update asynchronously; no date filter or FX repricing applies.
   */
  @Get('/current-asset-and-liability-balances-by-currency')
  @OperationId('getCurrentAssetAndLiabilityBalancesByCurrency')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async getCurrentAssetAndLiabilityBalancesByCurrency(
    @Queries() query: IGetCurrentAssetAndLiabilityBalancesByCurrencyQuery
  ) {
    return await getCurrentAssetAndLiabilityBalancesByCurrencyUseCase(
      query.type
    );
  }

  /**
   * Returns the current sum of top-level account balances for one type in
   * functional currency. Empty totals are zero. Balances update asynchronously;
   * no date filter or FX conversion applies.
   */
  @Get('/current-total-balance-by-type')
  @OperationId('getCurrentTotalBalanceByType')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async getCurrentTotalBalanceByType(
    @Queries() query: IGetCurrentTotalBalanceByTypeQuery
  ) {
    return await getCurrentTotalBalanceByTypeUseCase(query.type);
  }
  /**
   * Totals debits and credits by journal-line currency for a selected fiscal
   * year and ledger class. Equity accounts are not supported.
   * Inclusive dates default to fiscal year start and
   * min(today UTC, fiscal year end). Out-of-year or reversed ranges return 400.
   * Excludes draft and voided entries; includes every source type.
   */
  @Get('/ledger-total-debits-and-credits-by-currency')
  @OperationId('getLedgerTotalDebitsAndCreditsByCurrency')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async getLedgerTotalDebitsAndCreditsByCurrency(
    @Queries() query: IGetLedgerTotalDebitsAndCreditsByCurrencyQuery
  ) {
    return await getLedgerTotalDebitsAndCreditsByCurrencyUseCase(query);
  }

  /**
   * Summarizes revenue, expense, and suspense activity in functional currency
   * with account breakdowns. Dates are inclusive, up to 366 days, compared
   * with the preceding equal-length period. Opening balances and reversed
   * activity are excluded; zero denominators yield null percentages.
   */
  @Get('/revenue-and-expense-activity-summary')
  @OperationId('getRevenueAndExpenseActivitySummary')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async getRevenueAndExpenseActivitySummary(
    @Queries() query: IDateRangeDto
  ) {
    return await getRevenueAndExpenseActivitySummaryUseCase(query);
  }

  /**
   * Lists revenue, expense, and suspense posting accounts with current
   * functional balances. Shares use full revenue or expense totals before
   * filtering and pagination; suspense and zero totals yield null shares.
   * Balances update asynchronously; no date filter applies.
   */
  @Get('/revenue-expense-and-suspense-account-balances')
  @OperationId('getRevenueExpenseAndSuspenseAccountBalances')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async getRevenueExpenseAndSuspenseAccountBalances(
    @Queries() query: IGetRevenueExpenseAndSuspenseAccountBalancesQuery
  ) {
    return await getRevenueExpenseAndSuspenseAccountBalancesUseCase(query);
  }
}
