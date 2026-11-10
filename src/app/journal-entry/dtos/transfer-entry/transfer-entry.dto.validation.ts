import z from 'zod';

import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';

import {
  attachmentReferencesValidation,
  journalEntryAttachmentsUpdateReqValidation,
} from '@app/journal-entry/dtos/journal-entry/journal-entry-attachments.dto.validation';
import { journalLineReqValidation } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.validation';
import { exchangeRateJsonDtoValidation } from '@app/money/dtos/exchange-rate/exchange-rate.dto.validation';

const transferEntryLineReqValidation = journalLineReqValidation.omit({
  counterpartyId: true,
});

export const transferEntryReqValidation = z.object({
  attachmentReferences: attachmentReferencesValidation,
  sourceLine: transferEntryLineReqValidation,
  destinationLine: transferEntryLineReqValidation,
  chargeLines: z.array(journalLineReqValidation),
  effectiveDate: z.date(new journalEntryError.InvalidEffectiveDate().errorKey),
  postedAt: z
    .date(new journalEntryError.InvalidPostingDate().errorKey)
    .nullable(),
  memo: z.string(new journalEntryError.InvalidMemo().errorKey).nullable(),
});

const updateDraftTransferChargeLineReqValidation = journalLineReqValidation
  .partial()
  .extend({
    id: z.uuid(new journalEntryError.RectificationLineId().errorKey).optional(),
  })
  .strict();
const updateDraftTransferAssetLineReqValidation =
  updateDraftTransferChargeLineReqValidation.omit({ counterpartyId: true });

export const updateDraftTransferReqValidation = z.strictObject({
  attachments: journalEntryAttachmentsUpdateReqValidation,
  effectiveDate: transferEntryReqValidation.shape.effectiveDate.optional(),
  memo: transferEntryReqValidation.shape.memo.optional(),
  sourceLine: updateDraftTransferAssetLineReqValidation.optional(),
  destinationLine: updateDraftTransferAssetLineReqValidation.optional(),
  chargeLines: z.array(updateDraftTransferChargeLineReqValidation).optional(),
});

const transferEntryLineJsonReqValidation =
  transferEntryLineReqValidation.extend({
    exchangeRate: exchangeRateJsonDtoValidation.nullable(),
  });

export const transferEntryJsonReqValidation = transferEntryReqValidation.extend(
  {
    effectiveDate: z.iso
      .datetime({
        offset: true,
        error: new journalEntryError.InvalidEffectiveDate().errorKey,
      })
      .transform((value) => new Date(value))
      .pipe(transferEntryReqValidation.shape.effectiveDate),
    postedAt: z.iso
      .datetime({
        offset: true,
        error: new journalEntryError.InvalidPostingDate().errorKey,
      })
      .transform((value) => new Date(value))
      .pipe(transferEntryReqValidation.shape.postedAt.unwrap())
      .nullable(),
    sourceLine: transferEntryLineJsonReqValidation,
    destinationLine: transferEntryLineJsonReqValidation,
    chargeLines: z.array(
      journalLineReqValidation.extend({
        exchangeRate: exchangeRateJsonDtoValidation.nullable(),
      })
    ),
  }
);
