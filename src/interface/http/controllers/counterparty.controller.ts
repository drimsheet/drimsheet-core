import {
  Body,
  Controller,
  Delete,
  Get,
  Middlewares,
  OperationId,
  Patch,
  Path,
  Post,
  Queries,
  Response,
  Route,
  SuccessResponse,
  Tags,
} from 'tsoa';

import { IHttpErrorDto } from '@shared/values/errors/error.dto';

import { ICounterpartyArchiveReq } from '@app/counterparty/dtos/counterparty-archive/counterparty-archive.dto';
import { ICounterpartyDeletionReq } from '@app/counterparty/dtos/counterparty-deletion/counterparty-deletion.dto';
import {
  ICounterpartyCreateReq,
  ICounterpartyDto,
  ICounterpartyUpdateReq,
  IGetCounterpartiesQuery,
} from '@app/counterparty/dtos/counterparty/counterparty.dto';

import middlewares from '@infra/ioc/middlewares/http';
import {
  archiveCounterpartyUseCase,
  createCounterpartyUseCase,
  deleteCounterpartyUseCase,
  getCounterpartiesUseCase,
  getCounterpartyUseCase,
  updateCounterpartyUseCase,
} from '@infra/ioc/usecases/counterparty';

@Route('counterparties')
@Tags('Counterparty')
export class CounterpartyController extends Controller {
  /**
   * Get counterparties
   */
  @Get('/')
  @OperationId('getCounterparties')
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
  public async getCounterparties(@Queries() query: IGetCounterpartiesQuery) {
    return await getCounterpartiesUseCase(query);
  }

  /**
   * Get a counterparty by id
   */
  @Get('/{id}')
  @OperationId('getCounterparty')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async getCounterparty(@Path() id: string): Promise<ICounterpartyDto> {
    return await getCounterpartyUseCase(id);
  }

  /**
   * Create a new counterparty
   */
  @Post('/')
  @OperationId('createCounterparty')
  @SuccessResponse('201')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('409')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async createCounterparty(@Body() body: ICounterpartyCreateReq) {
    return await createCounterpartyUseCase(body);
  }

  /**
   * Update details and optionally activate a Draft. Supplied metadata replaces all roles.
   * A type change after transaction use returns 409 with field=type,
   * reason=transaction_usage and nextAction=create_counterparty.
   * This counterparty's type cannot be changed because it has been used in a
   * transaction. Create a new counterparty if a different type is required.
   */
  @Patch('/{id}')
  @OperationId('updateCounterparty')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('409')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async updateCounterparty(
    @Path() id: string,
    @Body() body: ICounterpartyUpdateReq
  ) {
    return await updateCounterpartyUseCase(id, body);
  }

  /**
   * Archive a counterparty while retaining its details and transaction references.
   * An already archived counterparty returns unchanged without another history or event.
   */
  @Post('/{id}/archive')
  @OperationId('archiveCounterparty')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('409')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async archiveCounterparty(
    @Path() id: string,
    @Body() body: ICounterpartyArchiveReq
  ): Promise<ICounterpartyDto> {
    return await archiveCounterpartyUseCase(id, body);
  }

  /**
   * Permanently delete a counterparty with no remaining transaction references.
   * References in archived transactions also block deletion. Returns 409 with
   * reason=transaction_usage and nextAction=archive_counterparty; retain the
   * counterparty and use POST /counterparties/{id}/archive instead.
   */
  @Delete('/{id}')
  @OperationId('deleteCounterparty')
  @SuccessResponse('204')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('409')
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async deleteCounterparty(
    @Path() id: string,
    @Body() body: ICounterpartyDeletionReq
  ): Promise<void> {
    await deleteCounterpartyUseCase(id, body);
  }
}
