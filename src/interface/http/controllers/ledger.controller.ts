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
  IPettyCashAccountCreationReq,
  IPettyCashAccountUpdateReq,
} from '@app/ledger/dtos/asset-account/asset-account.dto';
import { IHeaderAccountNameAliasesReq } from '@app/ledger/dtos/header-account/header-account.dto';
import {
  IGetLedgerAccountsQuery,
  ILedgerAccountDto,
} from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import { IGetPermittedPostingAccountsQuery } from '@app/ledger/dtos/permitted-posting-account/permitted-posting-account.dto';

import middlewares from '@infra/ioc/middlewares/http';
import {
  archiveLedgerAccountUseCase,
  createPettyCashAccountUseCase,
  getAccountTransactionsUseCase,
  getLedgerAccountsUseCase,
  getLedgerAccountUseCase,
  getPermittedPostingAccountsUseCase,
  setupHeaderAccountsUseCase,
  updatePettyCashAccountUseCase,
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
  ): Promise<ILedgerAccountDto> {
    return updatePettyCashAccountUseCase(accountId, body);
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
