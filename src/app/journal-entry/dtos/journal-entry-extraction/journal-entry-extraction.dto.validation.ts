import z from 'zod';

import stringUtils from '@shared/utils/string';
import fileAttachmentError from '@shared/values/file-attachments/file-attachment.error';
import getFileAttachmentTypeHelper from '@shared/values/file-attachments/helpers/get-file-attachment-type.helper';

import accountingError from '@domain/accounting/errors/accounting.error';
import actorError from '@domain/user/errors/actor.error';

import { journalEntryUploadReqValidation } from '@app/journal-entry/dtos/journal-entry-upload/journal-entry-upload.dto.validation';

import { IJournalEntryExtractionDto } from './journal-entry-extraction.dto';

const invalidFileUrlKey = new fileAttachmentError.InvalidUrl().errorKey;
const invalidFileNameKey = new fileAttachmentError.InvalidName().errorKey;
const invalidFileTypeKey = new fileAttachmentError.InvalidType().errorKey;
const invalidFileSizeKey = new fileAttachmentError.InvalidSize().errorKey;

const fileAttachmentDtoValidation = z.object({
  url: z.string(invalidFileUrlKey).refine(stringUtils.isUrl, invalidFileUrlKey),
  name: z
    .string(invalidFileNameKey)
    .refine(stringUtils.isNonEmptyString, invalidFileNameKey),
  type: z.string(invalidFileTypeKey).refine((type) => {
    try {
      getFileAttachmentTypeHelper(type);
      return true;
    } catch {
      return false;
    }
  }, invalidFileTypeKey),
  size: z.number(invalidFileSizeKey).positive(invalidFileSizeKey),
});

export const journalEntryExtractionDtoValidation = z.strictObject({
  accountId: journalEntryUploadReqValidation.shape.accountId,
  sourceType: journalEntryUploadReqValidation.shape.sourceType,
  actorId: z.uuid(new actorError.InvalidId().errorKey),
  accountingEntityId: z.uuid(
    new accountingError.InvalidAccountingEntityId().errorKey
  ),
  file: fileAttachmentDtoValidation,
}) satisfies z.ZodType<IJournalEntryExtractionDto>;
