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
import type {
  IGetBalancesByAccountQuery,
  IGetBalancesByBehaviorQuery,
  IGetBalancesBySubTypeQuery,
  IGetBalancesByTypeQuery,
} from '@app/reporting/dtos/balance-series/balance-series.dto';
import type { IDateRangeDto } from '@app/reporting/dtos/date/date-range.dto';
import type { IGetLedgerBalancesByCurrencyQuery } from '@app/reporting/dtos/ledger-balances-by-currency/ledger-balances-by-currency.dto';
import type { IGetRevenueExpenseAccountsQuery } from '@app/reporting/dtos/revenue-expense-accounts/revenue-expense-accounts.dto';

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
   * Closing balances in functional currency, grouped by accounts and closing date.
   * Inclusive periods up to 366 days; bucketDays is anchored at from. Includes
   * opening balances and archived history; carries balances across empty buckets.
   * Reads corrected journals directly, excluding drafts, voided originals and
   * reversals. Classification groups select their topmost matching accounts and
   * include each root's full subtree, using the root's normal balance. Explicit
   * IDs support posting and control accounts as independent series. Selected
   * roots without activity return zero; absent roots produce no series.
   * Account IDs must belong to the current entity. Amounts above 1 trillion
   * major units return 400; unsafe numeric serialization returns 500.
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
   * Closing balances in functional currency, grouped by behaviors and closing date.
   * Inclusive periods up to 366 days; bucketDays is anchored at from. Includes
   * opening balances and archived history; carries balances across empty buckets.
   * Reads corrected journals directly, excluding drafts, voided originals and
   * reversals. Classification groups select their topmost matching accounts and
   * include each root's full subtree, using the root's normal balance. Explicit
   * IDs support posting and control accounts as independent series. Selected
   * roots without activity return zero; absent roots produce no series.
   * Account IDs must belong to the current entity. Amounts above 1 trillion
   * major units return 400; unsafe numeric serialization returns 500.
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
   * Closing balances in functional currency, grouped by sub-types and closing date.
   * Inclusive periods up to 366 days; bucketDays is anchored at from. Includes
   * opening balances and archived history; carries balances across empty buckets.
   * Reads corrected journals directly, excluding drafts, voided originals and
   * reversals. Classification groups select their topmost matching accounts and
   * include each root's full subtree, using the root's normal balance. Explicit
   * IDs support posting and control accounts as independent series. Selected
   * roots without activity return zero; absent roots produce no series.
   * Account IDs must belong to the current entity. Amounts above 1 trillion
   * major units return 400; unsafe numeric serialization returns 500.
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
   * Closing balances in functional currency, grouped by types and closing date.
   * Inclusive periods up to 366 days; bucketDays is anchored at from. Includes
   * opening balances and archived history; carries balances across empty buckets.
   * Reads corrected journals directly, excluding drafts, voided originals and
   * reversals. Classification groups select their topmost matching accounts and
   * include each root's full subtree, using the root's normal balance. Explicit
   * IDs support posting and control accounts as independent series. Selected
   * roots without activity return zero; absent roots produce no series.
   * Account IDs must belong to the current entity. Amounts above 1 trillion
   * major units return 400; unsafe numeric serialization returns 500.
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
   * Current asset or liability posting balances grouped by account currency,
   * with a recorded functional balance per group and a total across groups.
   * Type is required input and is not returned. Accounts without a fixed
   * currency use functional currency. Includes all statuses, suspense and zero
   * balances; excludes control rollups. Groups sort by currency code. Reads
   * stored balances, which update asynchronously, without dates or FX repricing.
   * Empty reports return a zero functional total and no groups. Amount
   * magnitudes above 1 trillion major units return 400; missing balances return
   * 404; unsafe numeric serialization returns 500. Invalid type returns 422.
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
