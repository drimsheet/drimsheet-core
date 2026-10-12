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

import middlewares from '@infra/ioc/middlewares/http';
import { getAccountCashFlowUseCase } from '@infra/ioc/usecases/reporting';

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
}
