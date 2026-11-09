import z from 'zod';

import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import journalLineError from '@domain/journal-entry/errors/journal-line.error';

import {
  attachmentReferencesValidation,
  journalEntryAttachmentsUpdateReqValidation,
} from '@app/journal-entry/dtos/journal-entry/journal-entry-attachments.dto.validation';
import { journalLineReqValidation } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.validation';
import { exchangeRateJsonDtoValidation } from '@app/money/dtos/exchange-rate/exchange-rate.dto.validation';

const paymentEntryLineReqValidation = journalLineReqValidation.extend({
  counterpartyId: z.uuid(new journalLineError.InvalidCounterpartyId().errorKey),
});

export const paymentEntryReqValidation = z.object({
  attachmentReferences: attachmentReferencesValidation,
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

const updateDraftPaymentLineReqValidation = journalLineReqValidation
  .partial()
  .extend({
    id: z.uuid(new journalEntryError.RectificationLineId().errorKey).optional(),
  })
  .strict();

export const updateDraftPaymentReqValidation = z.strictObject({
  attachments: journalEntryAttachmentsUpdateReqValidation,
  effectiveDate: paymentEntryReqValidation.shape.effectiveDate.optional(),
  memo: paymentEntryReqValidation.shape.memo.optional(),
  sourceLine: updateDraftPaymentLineReqValidation.optional(),
  destinationLines: z.array(updateDraftPaymentLineReqValidation).optional(),
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
