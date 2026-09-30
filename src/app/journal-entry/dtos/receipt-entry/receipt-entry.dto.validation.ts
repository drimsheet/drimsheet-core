import z from 'zod';

import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import journalLineError from '@domain/journal-entry/errors/journal-line.error';

import {
  counterpartyNameValidation,
  counterpartyTypeValidation,
} from '@app/counterparty/dtos/counterparty/counterparty.dto.validation';
import fileAppError from '@app/file/errors/file.error';
import fileUploadPolicy from '@app/file/policies/file-upload.policy';
import { EFileUploadPurpose } from '@app/file/types/file.types';
import { journalLineReqValidation } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.validation';

const invalidAttachmentReferenceKey = new fileAppError.InvalidUploadReference()
  .errorKey;
const invalidUploadCountKey = new fileAppError.InvalidUploadCount().errorKey;
const maxAttachmentReferences = fileUploadPolicy.getPolicy(
  EFileUploadPurpose.JournalEntryAttachment
).maxFiles;

const receiptEntryLineReqValidation = journalLineReqValidation.extend({
  counterparty: z.object({
    id: z
      .uuid(new journalLineError.InvalidCounterpartyId().errorKey)
      .optional(),
    name: counterpartyNameValidation,
    type: counterpartyTypeValidation.optional(),
  }),
});

export const receiptEntryReqValidation = z.object({
  attachmentReferences: z
    .array(z.uuid(invalidAttachmentReferenceKey))
    .max(maxAttachmentReferences, invalidUploadCountKey)
    .refine(
      (references) => new Set(references).size === references.length,
      invalidAttachmentReferenceKey
    )
    .optional(),
  sourceLines: z
    .array(receiptEntryLineReqValidation)
    .min(1, new journalEntryError.InvalidLineItems().errorKey),
  destinationLine: receiptEntryLineReqValidation,
  effectiveDate: z.date(new journalEntryError.InvalidEffectiveDate().errorKey),
  postedAt: z
    .date(new journalEntryError.InvalidPostingDate().errorKey)
    .nullable(),
  memo: z.string(new journalEntryError.InvalidMemo().errorKey).nullable(),
});
