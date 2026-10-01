import {
  Body,
  Controller,
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

import {
  ICounterpartyCreateReq,
  ICounterpartyDto,
  ICounterpartyUpdateReq,
  IGetCounterpartiesQuery,
} from '@app/counterparty/dtos/counterparty/counterparty.dto';

import middlewares from '@infra/ioc/middlewares/http';
import {
  createCounterpartyUseCase,
  getCounterpartiesUseCase,
  getCounterpartyUseCase,
  updateCounterpartyUseCase,
} from '@infra/ioc/usecases/counterparty';

@Route('counterparties')
@Tags('Counterparty')
export class CounterpartyController extends Controller {
  /** Update details and optionally activate a Draft. Supplied metadata replaces all roles. */
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
}
