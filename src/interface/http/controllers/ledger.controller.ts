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

import { TEntityId } from '@shared/types/uuid';
import { IHttpErrorDto } from '@shared/values/errors/error.dto';
import { IPaginationDto } from '@shared/values/pagination/dto/pagination.dto';

import {
  IBankAccountCreationReq,
  IBankAccountUpdateReq,
  ICashAccountActivationDto,
  IPettyCashAccountCreationReq,
  IPettyCashAccountUpdateReq,
} from '@app/ledger/dtos/asset-account/asset-account.dto';
import {
  ICreateExpenseAccountDto,
  IUpdateExpenseAccountDto,
} from '@app/ledger/dtos/expense-account/expense-account.dto';
import { IHeaderAccountNameAliasesReq } from '@app/ledger/dtos/header-account/header-account.dto';
import { ILedgerAccountOpeningBalanceDto } from '@app/ledger/dtos/ledger-account-opening-balance/ledger-account-opening-balance.dto';
import {
  IGetLedgerAccountsQuery,
  ILedgerAccountDto,
  TLedgerAccountCurrencyUpdateEligibilityDto,
  TLedgerAccountDeletionEligibilityDto,
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
  activateCashAccountUseCase,
  activateExpenseAccountUseCase,
  activateRevenueAccountUseCase,
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
  deleteLedgerAccountUseCase,
  getAccountTransactionsUseCase,
  getBankDetailsUseCase,
  getLedgerAccountCurrencyUpdateEligibilityUseCase,
  getLedgerAccountDeletionEligibilityUseCase,
  getLedgerAccountOpeningBalanceUseCase,
  getLedgerAccountsUseCase,
  getLedgerAccountUseCase,
  getLedgerSubAccountsUseCase,
  getPermittedPostingAccountsUseCase,
  getRecommendedBootstrapUseCase,
  setupHeaderAccountsUseCase,
  updateBankAccountUseCase,
  updateExpenseAccountUseCase,
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

  /** Get the bank details of a ledger account with bank behavior. */
  @Get('/{accountId}/bank-details')
  @OperationId('getBankDetails')
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
  public async getBankDetails(@Path() accountId: string) {
    return getBankDetailsUseCase(accountId as TEntityId);
  }

  /**
   * Check whether an account is an asset with no historically posted journal entries.
   * Draft entries do not block eligibility. Ineligible results include the reason.
   * This result is advisory; currency updates also enforce their own validation.
   */
  @Get('/{accountId}/currency-update-eligibility')
  @OperationId('getLedgerAccountCurrencyUpdateEligibility')
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
  public async getLedgerAccountCurrencyUpdateEligibility(
    @Path() accountId: string
  ): Promise<TLedgerAccountCurrencyUpdateEligibilityDto> {
    return getLedgerAccountCurrencyUpdateEligibilityUseCase(accountId);
  }

  /**
   * Check whether a ledger account is not a header and is either draft or has
   * no associated journal entries. Ineligible results include the blocking reason.
   * This result is advisory.
   */
  @Get('/{accountId}/deletion-eligibility')
  @OperationId('getLedgerAccountDeletionEligibility')
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
  public async getLedgerAccountDeletionEligibility(
    @Path() accountId: string
  ): Promise<TLedgerAccountDeletionEligibilityDto> {
    return getLedgerAccountDeletionEligibilityUseCase(accountId);
  }

  /** Get the current draft or posted opening balance, or null when none exists. */
  @Get('/{accountId}/opening-balance')
  @OperationId('getLedgerAccountOpeningBalance')
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
  public async getLedgerAccountOpeningBalance(
    @Path() accountId: string
  ): Promise<ILedgerAccountOpeningBalanceDto> {
    return getLedgerAccountOpeningBalanceUseCase(accountId as TEntityId);
  }

  /** Get direct sub accounts only, returning an empty array when there are none. */
  @Get('/{accountId}/sub-accounts')
  @OperationId('getLedgerSubAccounts')
  @SuccessResponse('200')
  @Response<IHttpErrorDto>('400')
  @Response<IHttpErrorDto>('401')
  @Response<IHttpErrorDto>('403')
  @Response<IHttpErrorDto>('404')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async getLedgerSubAccounts(@Path() accountId: string) {
    return getLedgerSubAccountsUseCase(accountId as TEntityId);
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

  /** Update the name of a non-archived expense account, retaining its accounting identity and balances. */
  @Tags('Expense Accounts')
  @Patch('/expense/{accountId}')
  @OperationId('updateExpenseAccount')
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
  public async updateExpenseAccount(
    @Path() accountId: string,
    @Body() body: IUpdateExpenseAccountDto
  ) {
    return await updateExpenseAccountUseCase(accountId, body);
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

  /** Activates a draft petty cash or bank account beneath an active parent. Requires activateOpeningBalance; when true, posts the associated draft opening-balance journal atomically. When false, leaves the opening balance untouched. Other account families and non-draft accounts return 400. */
  @Tags('Asset Accounts')
  @Post('/asset/cash/{accountId}/activate')
  @OperationId('activateCashAccount')
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
  public activateCashAccount(
    @Path() accountId: string,
    @Body() body: ICashAccountActivationDto
  ) {
    return activateCashAccountUseCase(accountId, body);
  }

  /** Activates a draft expense account beneath an active parent. Requires no body; non-expense and non-draft accounts return 400. */
  @Tags('Expense Accounts')
  @Post('/expense/{accountId}/activate')
  @OperationId('activateExpenseAccount')
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
  public activateExpenseAccount(@Path() accountId: string): Promise<void> {
    return activateExpenseAccountUseCase(accountId);
  }

  /** Activates a draft revenue account beneath an active parent. Requires no body; non-revenue and non-draft accounts return 400. */
  @Tags('Revenue Accounts')
  @Post('/revenue/{accountId}/activate')
  @OperationId('activateRevenueAccount')
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
  public activateRevenueAccount(@Path() accountId: string): Promise<void> {
    return activateRevenueAccountUseCase(accountId);
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

  /** Deletes an eligible account and its eligible subtree with all associated draft journals. Accounts without a controlAccountId and non-draft accounts with journal entries return 400; a non-draft journal associated with a draft account is an unexpected invariant violation (500). */
  @Delete('/{accountId}')
  @OperationId('deleteLedgerAccount')
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
  public async deleteLedgerAccount(@Path() accountId: string): Promise<void> {
    return deleteLedgerAccountUseCase(accountId);
  }
}
