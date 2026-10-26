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

import type { IGetAccountCashFlowQuery } from '@app/ledger/usecases/reporting/account-cash-flow/dto';
import type { IGetAccountCounterpartyParticipationQuery } from '@app/ledger/usecases/reporting/account-counterparty-participation/dto';
import type {
  IGetBalancesByAccountQuery,
  IGetBalancesByBehaviorQuery,
  IGetBalancesBySubTypeQuery,
  IGetBalancesByTypeQuery,
} from '@app/ledger/usecases/reporting/balance-series/dto';
import type { IGetLedgerBalancesByCurrencyQuery } from '@app/ledger/usecases/reporting/ledger-balances-by-currency/dto';
import type { IGetRevenueExpenseAccountsQuery } from '@app/ledger/usecases/reporting/revenue-expense-accounts/dto';
import type { IDateRangeDto } from '@app/ledger/usecases/reporting/shared/date-range';

import middlewares from '@infra/ioc/middlewares/http';
import {
  getAccountCashFlowUseCase,
  getAccountCounterpartyParticipationUseCase,
  getBalancesByAccountUseCase,
  getBalancesByBehaviorUseCase,
  getBalancesBySubTypeUseCase,
  getBalancesByTypeUseCase,
  getLedgerBalancesByCurrencyUseCase,
  getRevenueExpenseAccountsUseCase,
  getRevenueExpenseSummaryUseCase,
} from '@infra/ioc/usecases/ledger.reporting';

@Route('reporting/ledger')
@Tags('Reporting', 'Ledger Reporting')
export class LedgerReportingController extends Controller {
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
   * Returns counterparty contributions to an account balance, including
   * descendants. Shares use the full account balance before filtering and
   * pagination; zero balances yield null shares. Self-transfers and
   * unattributed activity remain separate.
   */
  @Get('/accounts/{accountId}/counterparty-participation')
  @OperationId('getAccountCounterpartyParticipation')
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
  public async getAccountCounterpartyParticipation(
    @Path() accountId: string,
    @Queries() query: IGetAccountCounterpartyParticipationQuery
  ) {
    return await getAccountCounterpartyParticipationUseCase(accountId, query);
  }

  /**
   * Returns closing-balance series for selected accounts and their descendants
   * in functional currency. Each account forms an independent series.
   * Dates are inclusive, up to 366 days; balances carry across empty buckets.
   */
  @Get('/balances/accounts')
  @OperationId('getBalancesByAccount')
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
  public async getBalancesByAccount(
    @Queries() query: IGetBalancesByAccountQuery
  ) {
    return await getBalancesByAccountUseCase(query);
  }

  /**
   * Returns closing-balance series grouped by account behavior in functional
   * currency, including descendant activity. Dates are inclusive, up to
   * 366 days; balances carry across empty buckets.
   */
  @Get('/balances/behaviors')
  @OperationId('getBalancesByBehavior')
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
  public async getBalancesByBehavior(
    @Queries() query: IGetBalancesByBehaviorQuery
  ) {
    return await getBalancesByBehaviorUseCase(query);
  }

  /**
   * Returns closing-balance series grouped by account sub-type in functional
   * currency, including descendant activity. Dates are inclusive, up to
   * 366 days; balances carry across empty buckets.
   */
  @Get('/balances/sub-types')
  @OperationId('getBalancesBySubType')
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
  public async getBalancesBySubType(
    @Queries() query: IGetBalancesBySubTypeQuery
  ) {
    return await getBalancesBySubTypeUseCase(query);
  }

  /**
   * Returns closing-balance series grouped by account type in functional
   * currency, including descendant activity. Dates are inclusive, up to
   * 366 days; balances carry across empty buckets.
   */
  @Get('/balances/types')
  @OperationId('getBalancesByType')
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
  public async getBalancesByType(@Queries() query: IGetBalancesByTypeQuery) {
    return await getBalancesByTypeUseCase(query);
  }

  /**
   * Returns current asset or liability posting balances grouped by currency,
   * with recorded functional balances and a combined functional total.
   * Accounts without a fixed currency use functional currency. Stored
   * balances update asynchronously; no date filter or FX repricing applies.
   */
  @Get('/ledger-balances-by-currency')
  @OperationId('getLedgerBalancesByCurrency')
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
  public async getLedgerBalancesByCurrency(
    @Queries() query: IGetLedgerBalancesByCurrencyQuery
  ) {
    return await getLedgerBalancesByCurrencyUseCase(query.type);
  }

  /**
   * Lists revenue, expense, and suspense posting accounts with current
   * functional balances. Shares use full revenue or expense totals before
   * filtering and pagination; suspense and zero totals yield null shares.
   * Balances update asynchronously; no date filter applies.
   */
  @Get('/revenue-expense-accounts')
  @OperationId('getRevenueExpenseAccounts')
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
  public async getRevenueExpenseAccounts(
    @Queries() query: IGetRevenueExpenseAccountsQuery
  ) {
    return await getRevenueExpenseAccountsUseCase(query);
  }

  /**
   * Summarizes revenue, expense, and suspense activity in functional currency
   * with account breakdowns. Dates are inclusive, up to 366 days, compared
   * with the preceding equal-length period. Opening balances and reversed
   * activity are excluded; zero denominators yield null percentages.
   */
  @Get('/revenue-expense-summary')
  @OperationId('getRevenueExpenseSummary')
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
  public async getRevenueExpenseSummary(@Queries() query: IDateRangeDto) {
    return await getRevenueExpenseSummaryUseCase(query);
  }
}
