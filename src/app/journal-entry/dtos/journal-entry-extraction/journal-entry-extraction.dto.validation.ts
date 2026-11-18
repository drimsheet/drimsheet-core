import z from 'zod';

import accountingError from '@domain/accounting/errors/accounting.error';
import journalLineError from '@domain/journal-entry/errors/journal-line.error';
import actorError from '@domain/user/errors/actor.error';

import { fileAttachmentDtoValidation } from '@app/file/dtos/file-attachment/file-attachment.dto.validation';
import { journalEntrySourceTypeValidation } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.validation';

import {
  IJournalEntriesExtractionInput,
  IJournalEntryExtractionDto,
} from './journal-entry-extraction.dto';

export const journalEntriesExtractionInputValidation = z.strictObject({
  value: fileAttachmentDtoValidation.or(z.string()),
}) satisfies z.ZodType<IJournalEntriesExtractionInput>;

export const journalEntryExtractionDtoValidation = z.strictObject({
  accountId: z.uuid(new journalLineError.InvalidAccountId().errorKey),
  sourceType: journalEntrySourceTypeValidation.optional(),
  actorId: z.uuid(new actorError.InvalidId().errorKey),
  accountingEntityId: z.uuid(
    new accountingError.InvalidAccountingEntityId().errorKey
  ),
  value: journalEntriesExtractionInputValidation.shape.value,
}) satisfies z.ZodType<IJournalEntryExtractionDto>;
