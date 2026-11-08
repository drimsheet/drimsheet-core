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

import { TJournalEntryRectificationReq } from '@app/journal-entry/dtos/journal-entry-rectification/journal-entry-rectification.dto';
import { IGetJournalEntriesQuery } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import { IJournalEntryMetaUpdateReq } from '@app/journal-entry/dtos/meta-update/meta-update.dto';
import { IUpdateDraftOpeningBalanceReq } from '@app/journal-entry/dtos/opening-balance/opening-balance.dto';
import {
  IPaymentEntryReq,
  IUpdateDraftPaymentReq,
} from '@app/journal-entry/dtos/payment-entry/payment-entry.dto';
import {
  IReceiptEntryReq,
  IUpdateDraftReceiptReq,
} from '@app/journal-entry/dtos/receipt-entry/receipt-entry.dto';
import {
  ITransferEntryReq,
  IUpdateDraftTransferReq,
} from '@app/journal-entry/dtos/transfer-entry/transfer-entry.dto';

import middlewares from '@infra/ioc/middlewares/http';
import {
  archiveJournalEntryUseCase,
  createPaymentUseCase,
  createReceiptUseCase,
  createTransferUseCase,
  deleteJournalEntryUseCase,
  getJournalEntriesUseCase,
  getJournalEntryUseCase,
  postDraftOpeningBalanceUseCase,
  postDraftPaymentUseCase,
  postDraftReceiptUseCase,
  postDraftTransferUseCase,
  rectifyJournalEntryUseCase,
  updateDraftOpeningBalanceUseCase,
  updateDraftPaymentUseCase,
  updateDraftReceiptUseCase,
  updateDraftTransferUseCase,
  updateJournalEntryMetaUseCase,
  voidAndReplacePaymentUseCase,
  voidAndReplaceReceiptUseCase,
  voidAndReplaceTransferUseCase,
} from '@infra/ioc/usecases/journal-entry';

@Route('journal-entries')
@Tags('Journal Entry')
export class JournalEntryController extends Controller {
  /**
   * Get paginated journal entries with optional line participation filters
   */
  @Get('/')
  @OperationId('getJournalEntries')
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
  public async getJournalEntries(@Queries() query: IGetJournalEntriesQuery) {
    return getJournalEntriesUseCase(query);
  }

  /**
   * Get a journal entry by id
   */
  @Get('/{id}')
  @OperationId('getJournalEntry')
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
  public async getJournalEntry(@Path() id: string) {
    return getJournalEntryUseCase(id);
  }

  /**
   * Create payment journal entry
   */
  @Post('/payment')
  @OperationId('createPayment')
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
  public async createPayment(@Body() body: IPaymentEntryReq) {
    return createPaymentUseCase(body);
  }

  /**
   * Create receipt journal entry
   */
  @Post('/receipt')
  @OperationId('createReceipt')
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
  public async createReceipt(@Body() body: IReceiptEntryReq) {
    return createReceiptUseCase(body);
  }

  /**
   * Create transfer journal entry
   */
  @Post('/transfer')
  @OperationId('createTransfer')
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
  public async createTransfer(@Body() body: ITransferEntryReq) {
    return createTransferUseCase(body);
  }

  /** Updates the memo and existing line descriptions without financial changes. */
  @Patch('/{id}/meta')
  @OperationId('updateJournalEntryMeta')
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
  public async updateJournalEntryMeta(
    @Path() id: string,
    @Body() body: IJournalEntryMetaUpdateReq
  ) {
    return updateJournalEntryMetaUseCase(id, body);
  }

  /**
   * Correct a journal entry while preserving its accounting audit trail.
   */
  @Post('/{id}/rectify')
  @OperationId('rectifyJournalEntry')
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
  public async rectifyJournalEntry(
    @Path() id: string,
    @Body() body: TJournalEntryRectificationReq
  ) {
    return rectifyJournalEntryUseCase(id, body);
  }

  /** Updates the amount, effective date, exchange rate, memo, or attachments of a draft opening balance. */
  @Patch('/opening-balance/{id}')
  @OperationId('updateDraftOpeningBalance')
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
  public async updateDraftOpeningBalance(
    @Path() id: string,
    @Body() body: IUpdateDraftOpeningBalanceReq
  ) {
    return updateDraftOpeningBalanceUseCase(id, body);
  }

  /** Updates the memo, effective date, lines, or attachments of a draft payment. */
  @Patch('/payment/{id}')
  @OperationId('updateDraftPayment')
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
  public async updateDraftPayment(
    @Path() id: string,
    @Body() body: IUpdateDraftPaymentReq
  ) {
    return updateDraftPaymentUseCase(id, body);
  }

  /** Voids and reverses a posted payment and records a draft or posted replacement. */
  @Post('/payment/{id}/void-and-replace')
  @OperationId('voidAndReplacePayment')
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
  public async voidAndReplacePayment(
    @Path() id: string,
    @Body() body: IPaymentEntryReq
  ) {
    return voidAndReplacePaymentUseCase(id, body);
  }

  /** Edits a draft receipt's memo, effective date, lines, or attachments. */
  @Patch('/receipt/{id}')
  @OperationId('updateDraftReceipt')
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
  public async updateDraftReceipt(
    @Path() id: string,
    @Body() body: IUpdateDraftReceiptReq
  ) {
    return updateDraftReceiptUseCase(id, body);
  }

  /** Voids and reverses a posted receipt and records a draft or posted replacement. */
  @Post('/receipt/{id}/void-and-replace')
  @OperationId('voidAndReplaceReceipt')
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
  public async voidAndReplaceReceipt(
    @Path() id: string,
    @Body() body: IReceiptEntryReq
  ) {
    return voidAndReplaceReceiptUseCase(id, body);
  }

  /** Edits a draft transfer's memo, effective date, lines, or attachments. */
  @Patch('/transfer/{id}')
  @OperationId('updateDraftTransfer')
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
  public async updateDraftTransfer(
    @Path() id: string,
    @Body() body: IUpdateDraftTransferReq
  ) {
    return updateDraftTransferUseCase(id, body);
  }

  /** Voids and reverses a posted transfer and records its replacement. */
  @Post('/transfer/{id}/void-and-replace')
  @OperationId('voidAndReplaceTransfer')
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
  public async voidAndReplaceTransfer(
    @Path() id: string,
    @Body() body: ITransferEntryReq
  ) {
    return voidAndReplaceTransferUseCase(id, body);
  }

  /** Posts only the associated draft opening balance, preserving the ledger account's status. Requires a draft opening-balance journal and an active posting account. */
  @Post('/opening-balance/{id}/post')
  @OperationId('postOpeningBalance')
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
  public postOpeningBalance(@Path() id: string): Promise<void> {
    return postDraftOpeningBalanceUseCase(id);
  }

  /** Posts a draft payment while preserving its financial content. Revalidates accounts, counterparties, and the effective accounting period. */
  @Post('/payment/{id}/post')
  @OperationId('postPayment')
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
  public postPayment(@Path() id: string): Promise<void> {
    return postDraftPaymentUseCase(id);
  }

  /** Posts a draft receipt while preserving its financial content. Revalidates accounts, counterparties, and the effective accounting period. */
  @Post('/receipt/{id}/post')
  @OperationId('postReceipt')
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
  public postReceipt(@Path() id: string): Promise<void> {
    return postDraftReceiptUseCase(id);
  }

  /** Posts a draft transfer while preserving its financial content. Revalidates accounts, counterparties, and the effective accounting period. */
  @Post('/transfer/{id}/post')
  @OperationId('postTransfer')
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
  public postTransfer(@Path() id: string): Promise<void> {
    return postDraftTransferUseCase(id);
  }

  /**
   * Archive a journal entry without changing its financial effect.
   */
  @Post('/{id}/archive')
  @OperationId('archiveJournalEntry')
  @SuccessResponse('200')
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
  public async archiveJournalEntry(@Path() id: string) {
    return archiveJournalEntryUseCase(id);
  }

  /**
   * Delete a never-posted journal entry or reverse a previously-posted entry.
   */
  @Delete('/{id}')
  @OperationId('deleteJournalEntry')
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
  public async deleteJournalEntry(@Path() id: string): Promise<void> {
    await deleteJournalEntryUseCase(id);
  }
}
