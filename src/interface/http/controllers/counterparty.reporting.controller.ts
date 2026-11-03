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

import type { IGetCounterpartyAccountTypeParticipationQuery } from '@app/counterparty/usecases/reporting/participation-by-account-type/dto';

import middlewares from '@infra/ioc/middlewares/http';
import { getCounterpartyAccountTypeParticipationUseCase } from '@infra/ioc/usecases/counterparty.reporting';

@Route('reporting/counterparties')
@Tags('Reporting', 'Counterparty Reporting')
export class CounterpartyReportingController extends Controller {
  /**
   * Returns net revenue and expense participation for the full fiscal
   * year in functional currency. Counts only lines attributed to this party.
   * Includes posted opening balances and archived records; originals and
   * reversals retain their own effective dates. Missing activity returns zero.
   */
  @Get('/{counterpartyId}/participation-by-account-type')
  @OperationId('getCounterpartyAccountTypeParticipation')
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
  public async getCounterpartyAccountTypeParticipation(
    @Path() counterpartyId: string,
    @Queries() query: IGetCounterpartyAccountTypeParticipationQuery
  ) {
    return await getCounterpartyAccountTypeParticipationUseCase(
      counterpartyId,
      query
    );
  }
}
