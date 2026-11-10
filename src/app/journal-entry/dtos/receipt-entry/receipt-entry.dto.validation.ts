import z from 'zod';

import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import journalLineError from '@domain/journal-entry/errors/journal-line.error';

import {
  attachmentReferencesValidation,
  journalEntryAttachmentsUpdateReqValidation,
} from '@app/journal-entry/dtos/journal-entry/journal-entry-attachments.dto.validation';
import { journalLineReqValidation } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.validation';
import { exchangeRateJsonDtoValidation } from '@app/money/dtos/exchange-rate/exchange-rate.dto.validation';

const receiptEntryLineReqValidation = journalLineReqValidation.extend({
  counterpartyId: z.uuid(new journalLineError.InvalidCounterpartyId().errorKey),
});

export const receiptEntryReqValidation = z.object({
  attachmentReferences: attachmentReferencesValidation,
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

const updateDraftReceiptLineReqValidation = journalLineReqValidation
  .partial()
  .extend({
    id: z.uuid(new journalEntryError.RectificationLineId().errorKey).optional(),
  })
  .strict();

export const updateDraftReceiptReqValidation = z.strictObject({
  attachments: journalEntryAttachmentsUpdateReqValidation,
  effectiveDate: receiptEntryReqValidation.shape.effectiveDate.optional(),
  memo: receiptEntryReqValidation.shape.memo.optional(),
  sourceLines: z.array(updateDraftReceiptLineReqValidation).optional(),
  destinationLine: updateDraftReceiptLineReqValidation.optional(),
});

const receiptEntryLineJsonReqValidation = receiptEntryLineReqValidation.extend({
  exchangeRate: exchangeRateJsonDtoValidation.nullable(),
});

export const receiptEntryJsonReqValidation = receiptEntryReqValidation.extend({
  effectiveDate: z.iso
    .datetime({
      offset: true,
      error: new journalEntryError.InvalidEffectiveDate().errorKey,
    })
    .transform((value) => new Date(value))
    .pipe(receiptEntryReqValidation.shape.effectiveDate),
  postedAt: z.iso
    .datetime({
      offset: true,
      error: new journalEntryError.InvalidPostingDate().errorKey,
    })
    .transform((value) => new Date(value))
    .pipe(receiptEntryReqValidation.shape.postedAt.unwrap())
    .nullable(),
  sourceLines: z
    .array(receiptEntryLineJsonReqValidation)
    .min(1, new journalEntryError.InvalidLineItems().errorKey),
  destinationLine: receiptEntryLineJsonReqValidation,
});
