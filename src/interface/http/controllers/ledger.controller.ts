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

import { TEntityId } from '@shared/types/uuid';
import { IHttpErrorDto } from '@shared/values/errors/error.dto';
import { IPaginationDto } from '@shared/values/pagination/dto/pagination.dto';

import {
  IBankAccountCreationReq,
  IBankAccountUpdateReq,
  IPettyCashAccountCreationReq,
  IPettyCashAccountUpdateReq,
} from '@app/ledger/dtos/asset-account/asset-account.dto';
import { ICreateExpenseAccountDto } from '@app/ledger/dtos/expense-account/expense-account.dto';
import { IHeaderAccountNameAliasesReq } from '@app/ledger/dtos/header-account/header-account.dto';
import {
  IGetLedgerAccountsQuery,
  ILedgerAccountDto,
} from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import {
  ICreateStatutoryPayableAccountDto,
  ICreateTradePayableAccountDto,
} from '@app/ledger/dtos/payable-account/payable-account.dto';
import { IGetPermittedPostingAccountsQuery } from '@app/ledger/dtos/permitted-posting-account/permitted-posting-account.dto';
import {
  ICreateStatutoryReceivableAccountDto,
  ICreateTradeReceivableAccountDto,
} from '@app/ledger/dtos/receivable-account/receivable-account.dto';
import {
  ICreateRevenueAccountDto,
  IUpdateRevenueAccountDto,
} from '@app/ledger/dtos/revenue-account/revenue-account.dto';
import { ICreateSuspenseAccountDto } from '@app/ledger/dtos/suspense-account/suspense-account.dto';

import middlewares from '@infra/ioc/middlewares/http';
import {
  archiveLedgerAccountUseCase,
  createBankAccountUseCase,
  createExpenseAccountUseCase,
  createPettyCashAccountUseCase,
  createRevenueAccountUseCase,
  createStatutoryPayableAccountUseCase,
  createStatutoryReceivableAccountUseCase,
  createSuspenseAccountUseCase,
  createTradePayableAccountUseCase,
  createTradeReceivableAccountUseCase,
  getAccountTransactionsUseCase,
  getLedgerAccountsUseCase,
  getLedgerAccountUseCase,
  getPermittedPostingAccountsUseCase,
  getRecommendedBootstrapUseCase,
  setupHeaderAccountsUseCase,
  updateBankAccountUseCase,
  updatePettyCashAccountUseCase,
  updateRevenueAccountUseCase,
} from '@infra/ioc/usecases/ledger';

@Route('ledger')
@Tags('Ledger')
export class LedgerController extends Controller {
  /**
   * Get paginated ledger accounts with optional filters
   */
  @Get('/')
  @OperationId('getLedgerAccounts')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('422')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1
  )
  public async getLedgerAccounts(@Queries() query: IGetLedgerAccountsQuery) {
    return getLedgerAccountsUseCase(query);
  }

  /**
   * Get paginated posting accounts permitted by a journal-entry rule
   */
  @Get('/posting-accounts')
  @OperationId('getPermittedPostingAccounts')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('422')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async getPermittedPostingAccounts(
    @Queries() query: IGetPermittedPostingAccountsQuery
  ) {
    return getPermittedPostingAccountsUseCase(query);
  }

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
  public getRecommendedBootstrap() {
    return getRecommendedBootstrapUseCase();
  }

  /**
   * Get a single ledger account by id
   */
  @Get('/:accountId')
  @OperationId('getLedgerAccount')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('403')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1
  )
  public async getLedgerAccount(@Path() accountId: string) {
    return getLedgerAccountUseCase(accountId as TEntityId);
  }

  /**
   * List transactions for an account
   */
  @Get('/:accountId/transactions')
  @OperationId('listTransactions')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('403')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async listTransactions(
    @Path('accountId') accountId: string,
    @Queries() pagination: IPaginationDto
  ) {
    return getAccountTransactionsUseCase(accountId as TEntityId, pagination);
  }

  /** Set up all 24 header, equity, and standard receivable/payable control accounts atomically, with optional translated names. */
  @Post('/header-accounts/setup')
  @OperationId('setupHeaderAccounts')
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
  public async setupHeaderAccounts(
    @Body() body?: IHeaderAccountNameAliasesReq
  ) {
    return setupHeaderAccountsUseCase(body);
  }

  /**
   * Create an Active or Draft bank subaccount; status defaults to Active.
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

  /**
   * Create an Active or Draft petty-cash subaccount; status defaults to Active.
   */
  @Tags('Asset Accounts')
  @Post('/asset/petty-cash')
  @OperationId('createPettyCashAccount')
  @SuccessResponse('201')
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
  public async createPettyCashAccount(
    @Body() body: IPettyCashAccountCreationReq
  ) {
    return createPettyCashAccountUseCase(body);
  }

  /** Create an Active or Draft statutory receivable subaccount; status defaults to Active. */
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

  /** Create an Active or Draft trade receivable subaccount; status defaults to Active. */
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

  /** Create an Active or Draft expense subaccount; status defaults to Active. */
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

  /** Create an Active or Draft statutory payable subaccount; status defaults to Active. */
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

  /** Create an Active or Draft trade payable subaccount; status defaults to Active. */
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

  /** Create an Active or Draft revenue subaccount; status defaults to Active. */
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

  /** Update the name, bank details, and/or opening balance of a non-archived bank account. Supplied bank details replace all three fields; omitted fields are retained. */
  @Tags('Asset Accounts')
  @Patch('/asset/bank/{accountId}')
  @OperationId('updateBankAccount')
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
  public async updateBankAccount(
    @Path() accountId: string,
    @Body() body: IBankAccountUpdateReq
  ) {
    return await updateBankAccountUseCase(accountId, body);
  }

  /** Update the name and/or opening balance of a non-archived petty cash account. Omitted fields are retained. */
  @Tags('Asset Accounts')
  @Patch('/asset/petty-cash/{accountId}')
  @OperationId('updatePettyCashAccount')
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
  public async updatePettyCashAccount(
    @Path() accountId: string,
    @Body() body: IPettyCashAccountUpdateReq
  ) {
    return updatePettyCashAccountUseCase(accountId, body);
  }

  /** Update the name of a non-archived revenue account, retaining its accounting identity and balances. */
  @Tags('Revenue Accounts')
  @Patch('/revenue/{accountId}')
  @OperationId('updateRevenueAccount')
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
  public async updateRevenueAccount(
    @Path() accountId: string,
    @Body() body: IUpdateRevenueAccountDto
  ) {
    return await updateRevenueAccountUseCase(accountId, body);
  }

  /** Archives a non-header account and all control-account descendants, retaining history. Already archived accounts are no-ops. Header accounts return 400. Archived accounts cannot appear in new journals, including reversals. */
  @Post('/{accountId}/archive')
  @OperationId('archiveLedgerAccount')
  @SuccessResponse('204')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Response<IHttpErrorDto>('409')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async archiveLedgerAccount(@Path() accountId: string): Promise<void> {
    return archiveLedgerAccountUseCase(accountId);
  }
}
