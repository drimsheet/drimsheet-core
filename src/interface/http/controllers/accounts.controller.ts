import {
  Body,
  Controller,
  Get,
  Middlewares,
  OperationId,
  Post,
  Response,
  Route,
  SuccessResponse,
  Tags,
} from 'tsoa';

import { IHttpErrorDto } from '@shared/values/errors/error.dto';

import { IBankAccountCreationReq } from '@app/ledger/dtos/asset-account/asset-account.dto';
import { IRecommendedBootstrapDto } from '@app/ledger/dtos/recommended-bootstrap/recommended-bootstrap.dto';

import middlewares from '@infra/ioc/middlewares/http';
import {
  createBankAccountUseCase,
  getRecommendedBootstrapUseCase,
} from '@infra/ioc/usecases/ledger';

@Route('accounts')
@Tags('Accounts')
export class AccountsController extends Controller {
  /** Get recommended posting account setup, grouped with nested sub accounts. */
  @Get('/recommended-bootstrap')
  @OperationId('getRecommendedBootstrap')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1
  )
  public async getRecommendedBootstrap(): Promise<IRecommendedBootstrapDto> {
    return getRecommendedBootstrapUseCase();
  }

  /**
   * Create a new asset bank sub account
   */
  @Tags('Asset Accounts')
  @Post('/asset/bank')
  @OperationId('createBankAccount')
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
  public async createBankAccount(@Body() body: IBankAccountCreationReq) {
    this.setStatus(201);
    return await createBankAccountUseCase(body);
  }
}
