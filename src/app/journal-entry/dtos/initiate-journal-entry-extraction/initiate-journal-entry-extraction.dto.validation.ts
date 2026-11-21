import z from 'zod';

import fileAppError from '@app/file/errors/file.error';

export const initiateJournalEntryExtractionReqValidation = z.strictObject({
  reference: z.uuid(new fileAppError.InvalidUploadReference().errorKey),
});
