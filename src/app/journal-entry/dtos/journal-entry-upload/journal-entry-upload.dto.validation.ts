import z from 'zod';

import journalLineError from '@domain/journal-entry/errors/journal-line.error';

import fileAppError from '@app/file/errors/file.error';
import { journalEntrySourceTypeValidation } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.validation';

export const journalEntryUploadReqValidation = z.strictObject({
  reference: z.uuid(new fileAppError.InvalidUploadReference().errorKey),
  accountId: z.uuid(new journalLineError.InvalidAccountId().errorKey),
  sourceType: journalEntrySourceTypeValidation.optional(),
});
