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
import { exchangeRateJsonDtoValidation } from '@app/money/dtos/exchange-rate/exchange-rate.dto.validation';

const invalidAttachmentReferenceKey = new fileAppError.InvalidUploadReference()
  .errorKey;
const invalidUploadCountKey = new fileAppError.InvalidUploadCount().errorKey;
const maxAttachmentReferences = fileUploadPolicy.getPolicy(
  EFileUploadPurpose.JournalEntryAttachment
).maxFiles;

const paymentEntryLineReqValidation = journalLineReqValidation.extend({
  counterparty: z.object({
    id: z
      .uuid(new journalLineError.InvalidCounterpartyId().errorKey)
      .optional(),
    name: counterpartyNameValidation,
    type: counterpartyTypeValidation.optional(),
  }),
});

export const paymentEntryReqValidation = z.object({
  attachmentReferences: z
    .array(z.uuid(invalidAttachmentReferenceKey))
    .max(maxAttachmentReferences, invalidUploadCountKey)
    .refine(
      (references) => new Set(references).size === references.length,
      invalidAttachmentReferenceKey
    )
    .optional(),
  sourceLine: paymentEntryLineReqValidation,
  destinationLines: z
    .array(paymentEntryLineReqValidation)
    .min(1, new journalEntryError.InvalidLineItems().errorKey),
  effectiveDate: z.date(new journalEntryError.InvalidEffectiveDate().errorKey),
  postedAt: z
    .date(new journalEntryError.InvalidPostingDate().errorKey)
    .nullable(),
  memo: z.string(new journalEntryError.InvalidMemo().errorKey).nullable(),
});

const paymentEntryLineJsonReqValidation = paymentEntryLineReqValidation.extend({
  exchangeRate: exchangeRateJsonDtoValidation.nullable(),
});

export const paymentEntryJsonReqValidation = paymentEntryReqValidation.extend({
  effectiveDate: z.iso
    .datetime({
      offset: true,
      error: new journalEntryError.InvalidEffectiveDate().errorKey,
    })
    .transform((value) => new Date(value))
    .pipe(paymentEntryReqValidation.shape.effectiveDate),
  postedAt: z.iso
    .datetime({
      offset: true,
      error: new journalEntryError.InvalidPostingDate().errorKey,
    })
    .transform((value) => new Date(value))
    .pipe(paymentEntryReqValidation.shape.postedAt.unwrap())
    .nullable(),
  sourceLine: paymentEntryLineJsonReqValidation,
  destinationLines: z
    .array(paymentEntryLineJsonReqValidation)
    .min(1, new journalEntryError.InvalidLineItems().errorKey),
});
