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
import { ICreateExpenseAccountDto } from '@app/ledger/dtos/expense-account/expense-account.dto';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import {
  ICreateStatutoryPayableAccountDto,
  ICreateTradePayableAccountDto,
} from '@app/ledger/dtos/payable-account/payable-account.dto';
import {
  ICreateStatutoryReceivableAccountDto,
  ICreateTradeReceivableAccountDto,
} from '@app/ledger/dtos/receivable-account/receivable-account.dto';
import { IRecommendedBootstrapDto } from '@app/ledger/dtos/recommended-bootstrap/recommended-bootstrap.dto';
import { ICreateRevenueAccountDto } from '@app/ledger/dtos/revenue-account/revenue-account.dto';
import { ICreateSuspenseAccountDto } from '@app/ledger/dtos/suspense-account/suspense-account.dto';

import middlewares from '@infra/ioc/middlewares/http';
import {
  createBankAccountUseCase,
  createExpenseAccountUseCase,
  createRevenueAccountUseCase,
  createStatutoryPayableAccountUseCase,
  createStatutoryReceivableAccountUseCase,
  createSuspenseAccountUseCase,
  createTradePayableAccountUseCase,
  createTradeReceivableAccountUseCase,
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

  /** Create one revenue account with an initial zero balance. */
  @Tags('Revenue Accounts')
  @Post('/revenues')
  @OperationId('createRevenueAccount')
  @SuccessResponse('201')
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
  public async createRevenueAccount(
    @Body() body: ICreateRevenueAccountDto
  ): Promise<ILedgerAccountDto> {
    this.setStatus(201);
    return createRevenueAccountUseCase(body);
  }

  /** Create one expense account with an initial zero balance. */
  @Tags('Expense Accounts')
  @Post('/expenses')
  @OperationId('createExpenseAccount')
  @SuccessResponse('201')
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
  public async createExpenseAccount(
    @Body() body: ICreateExpenseAccountDto
  ): Promise<ILedgerAccountDto> {
    this.setStatus(201);
    return createExpenseAccountUseCase(body);
  }

  /** Create one trade receivable account with an initial zero balance. */
  @Tags('Asset Accounts')
  @Post('/asset/receivables/trade')
  @OperationId('createTradeReceivableAccount')
  @SuccessResponse('201')
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
  public async createTradeReceivableAccount(
    @Body() body: ICreateTradeReceivableAccountDto
  ): Promise<ILedgerAccountDto> {
    this.setStatus(201);
    return createTradeReceivableAccountUseCase(body);
  }

  /** Create one statutory receivable account with an initial zero balance. */
  @Tags('Asset Accounts')
  @Post('/asset/receivables/statutory')
  @OperationId('createStatutoryReceivableAccount')
  @SuccessResponse('201')
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
  public async createStatutoryReceivableAccount(
    @Body() body: ICreateStatutoryReceivableAccountDto
  ): Promise<ILedgerAccountDto> {
    this.setStatus(201);
    return createStatutoryReceivableAccountUseCase(body);
  }

  /** Create one trade payable account with an initial zero balance. */
  @Tags('Liability Accounts')
  @Post('/liability/payables/trade')
  @OperationId('createTradePayableAccount')
  @SuccessResponse('201')
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
  public async createTradePayableAccount(
    @Body() body: ICreateTradePayableAccountDto
  ): Promise<ILedgerAccountDto> {
    this.setStatus(201);
    return createTradePayableAccountUseCase(body);
  }

  /** Create one statutory payable account with an initial zero balance. */
  @Tags('Liability Accounts')
  @Post('/liability/payables/statutory')
  @OperationId('createStatutoryPayableAccount')
  @SuccessResponse('201')
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
  public async createStatutoryPayableAccount(
    @Body() body: ICreateStatutoryPayableAccountDto
  ): Promise<ILedgerAccountDto> {
    this.setStatus(201);
    return createStatutoryPayableAccountUseCase(body);
  }

  /** Create one asset or liability suspense account for the selected currency. */
  @Post('/suspense')
  @OperationId('createSuspenseAccount')
  @SuccessResponse('201')
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
  public async createSuspenseAccount(
    @Body() body: ICreateSuspenseAccountDto
  ): Promise<ILedgerAccountDto> {
    this.setStatus(201);
    return createSuspenseAccountUseCase(body);
  }
}
