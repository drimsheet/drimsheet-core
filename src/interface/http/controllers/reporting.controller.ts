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

import type { IGetAccountCashFlowQuery } from '@app/reporting/dtos/account-cash-flow/account-cash-flow.dto';
import type { IGetAccountCounterpartyParticipationQuery } from '@app/reporting/dtos/account-counterparty-participation/account-counterparty-participation.dto';
import type { IDateRangeDto } from '@app/reporting/dtos/date/date-range.dto';
import type { IGetRevenueExpenseAccountsQuery } from '@app/reporting/dtos/revenue-expense-accounts/revenue-expense-accounts.dto';

import middlewares from '@infra/ioc/middlewares/http';
import {
  getAccountCashFlowUseCase,
  getAccountCounterpartyParticipationUseCase,
  getAssetLiabilitySummaryUseCase,
  getRevenueExpenseAccountsUseCase,
  getRevenueExpenseSummaryUseCase,
} from '@infra/ioc/usecases/reporting';

@Route('reporting')
@Tags('Reporting')
export class ReportingController extends Controller {
  /**
   * Money in/out for a bank or petty-cash posting account, in its own currency.
   * Dates are inclusive; periods longer than 366 days return 400. Buckets start
   * at from and include zero-activity intervals. Corrected originals, reversals,
   * drafts, never-posted entries and opening balances are excluded. Historical
   * results can change after rectification. Either gross total above 1 trillion
   * major currency units returns 400. Unsafe numeric serialization returns 500.
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
   * Counterparty contributions to the current balance of a posting or control
   * account, including descendants. Reads journals through only the requested
   * account's adjustments, excluding drafts, never-posted entries, voided
   * originals and reversals. Archived records and opening balances remain included.
   * Amounts use account currency, falling back to functional currency. Shares
   * use the stored account balance before search/pagination, rounded to two
   * decimals; zero balances yield null. Balances update asynchronously.
   * Counterparty-less transfers have isSelf=true and search by entity name;
   * other unattributed lines have isSelf=false. Counterparties sort by name/ID,
   * followed by self and unattributed rows. Defaults to page 1, limit 10.
   * Amount magnitudes above 1 trillion major units return 400; missing accounts
   * or balances return 404; unsafe numeric serialization returns 500.
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
   * Cumulative assets, liabilities and net assets in the functional currency.
   * Dates are inclusive, up to 366 days. Compares balances at period end with
   * the end of the immediately preceding equal-length period. Includes opening
   * balances, suspense, contra/adjunct and archived accounts. Excludes drafts,
   * never-posted entries, voided originals and reversals. Journal lines are
   * counted once without hierarchy rollups. Historical results can change after
   * rectification. Percentage changes use the absolute previous balance and are
   * null when it is zero. Amount magnitudes above 1 trillion major units return
   * 400; unsafe numeric serialization returns 500.
   */
  @Get('/asset-liability-summary')
  @OperationId('getAssetLiabilitySummary')
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
  public async getAssetLiabilitySummary(@Queries() query: IDateRangeDto) {
    return await getAssetLiabilitySummaryUseCase(query);
  }

  /**
   * Revenue/expense and suspense posting accounts (isControlAccount=false) with
   * current accumulated functional balances. Balances update asynchronously;
   * counts read each posting account's own live journal lines in all states.
   * All account statuses and zero balances remain visible. Shares use the summed
   * balances of root revenue/expense headers (controlAccountId=null) of the same
   * type before search/pagination; headers are never included as table rows;
   * suspense and zero totals have null shares. Omit type for All. Search matches
   * account name or code; rows sort by code then ID. No date range is applied.
   * Amount magnitudes above 1 trillion major units return 400; missing balances
   * or unsafe numeric serialization return 500.
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
   * Revenue, expenses and suspense activity in the entity's functional currency.
   * Dates are inclusive, up to 366 days, compared with the immediately preceding
   * equal-length period. Revenue is credits less debits; expenses are debits less
   * credits. Suspense counts distinct entries and sums suspense-line amounts.
   * Drafts, never-posted entries, voided originals, reversals and opening balances
   * are excluded. Archived account activity remains included. Historical results
   * can change after rectification. Zero denominators produce null percentages.
   * Amount magnitudes above 1 trillion major units return 400; unsafe numeric
   * serialization returns 500. Returns posting-account breakdowns, not rollups.
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
