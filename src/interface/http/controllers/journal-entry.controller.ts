import {
  Body,
  Controller,
  Delete,
  Get,
  Middlewares,
  OperationId,
  Path,
  Post,
  Queries,
  Response,
  Route,
  SuccessResponse,
  Tags,
} from 'tsoa';

import { IHttpErrorDto } from '@shared/values/errors/error.dto';

import { IJournalEntryArchiveReq } from '@app/journal-entry/dtos/journal-entry-archive/journal-entry-archive.dto';
import { IJournalEntryDeletionReq } from '@app/journal-entry/dtos/journal-entry-deletion/journal-entry-deletion.dto';
import { TJournalEntryRectificationReq } from '@app/journal-entry/dtos/journal-entry-rectification/journal-entry-rectification.dto';
import { IGetJournalEntriesQuery } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import { IPaymentEntryReq } from '@app/journal-entry/dtos/payment-entry/payment-entry.dto';
import { IReceiptEntryReq } from '@app/journal-entry/dtos/receipt-entry/receipt-entry.dto';
import { ITransferEntryReq } from '@app/journal-entry/dtos/transfer-entry/transfer-entry.dto';

import middlewares from '@infra/ioc/middlewares/http';
import {
  archiveJournalEntryUseCase,
  createPaymentUseCase,
  createReceiptUseCase,
  createTransferUseCase,
  deleteJournalEntryUseCase,
  getJournalEntriesUseCase,
  getJournalEntryUseCase,
  rectifyJournalEntryUseCase,
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
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async archiveJournalEntry(
    @Path() id: string,
    @Body() body: IJournalEntryArchiveReq
  ) {
    return archiveJournalEntryUseCase(id, body);
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
  @Response<IHttpErrorDto>('422')
  @Response<IHttpErrorDto>('500')
  @Middlewares(
    middlewares.isAuthenticatedUser,
    middlewares.featureFlagAccess.canAccessAlpha1,
    middlewares.accountingEntityAccess
  )
  public async deleteJournalEntry(
    @Path() id: string,
    @Body() body: IJournalEntryDeletionReq
  ): Promise<void> {
    await deleteJournalEntryUseCase(id, body);
  }
}
