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
import type { IGetAssetAndLiabilityBalancesByCurrencyQuery } from '@app/ledger/usecases/reporting/asset-and-liability-balances-by-currency/dto';
import type { IGetBalancesByAccountQuery } from '@app/ledger/usecases/reporting/balances-by-account/dto';
import type { IGetBalancesByBehaviorQuery } from '@app/ledger/usecases/reporting/balances-by-behavior/dto';
import type { IGetBalancesBySubTypeQuery } from '@app/ledger/usecases/reporting/balances-by-sub-type/dto';
import type { IGetBalancesByTypeQuery } from '@app/ledger/usecases/reporting/balances-by-type/dto';
import type { IGetLedgerTotalDebitsAndCreditsByCurrencyQuery } from '@app/ledger/usecases/reporting/ledger-total-debits-and-credits-by-currency/dto';
import type { IGetRevenueExpenseAccountsQuery } from '@app/ledger/usecases/reporting/revenue-expense-accounts/dto';
import type { IDateRangeDto } from '@app/ledger/usecases/reporting/shared/date-range';
import type { IGetTotalBalanceByTypeQuery } from '@app/ledger/usecases/reporting/total-balance-by-type/dto';

import middlewares from '@infra/ioc/middlewares/http';
import {
  getAccountCashFlowUseCase,
  getAccountCounterpartyParticipationUseCase,
  getAssetAndLiabilityBalancesByCurrencyUseCase,
  getBalancesByAccountUseCase,
  getBalancesByBehaviorUseCase,
  getBalancesBySubTypeUseCase,
  getBalancesByTypeUseCase,
  getLedgerTotalDebitsAndCreditsByCurrencyUseCase,
  getRevenueExpenseAccountsUseCase,
  getRevenueExpenseSummaryUseCase,
  getTotalBalanceByTypeUseCase,
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
   * Returns current asset or liability posting balances grouped by currency,
   * with recorded functional balances and a combined functional total.
   * Accounts without a fixed currency use functional currency. Stored
   * balances update asynchronously; no date filter or FX repricing applies.
   */
  @Get('/asset-and-liability-balances-by-currency')
  @OperationId('getAssetAndLiabilityBalancesByCurrency')
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
  public async getAssetAndLiabilityBalancesByCurrency(
    @Queries() query: IGetAssetAndLiabilityBalancesByCurrencyQuery
  ) {
    return await getAssetAndLiabilityBalancesByCurrencyUseCase(query.type);
  }

  /**
   * Returns closing-balance series for selected accounts and their descendants
   * in functional currency. Each account forms an independent series.
   * Dates are inclusive, up to 366 days; balances carry across empty buckets.
   */
  @Get('/balances-by-account')
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
  @Get('/balances-by-behavior')
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
  @Get('/balances-by-sub-type')
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
  @Get('/balances-by-type')
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

  /**
   * Returns the current sum of top-level account balances for one type in
   * functional currency. Empty totals are zero. Balances update asynchronously;
   * no date filter or FX conversion applies.
   */
  @Get('/total-balance-by-type')
  @OperationId('getTotalBalanceByType')
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
  public async getTotalBalanceByType(
    @Queries() query: IGetTotalBalanceByTypeQuery
  ) {
    return await getTotalBalanceByTypeUseCase(query.type);
  }
}
