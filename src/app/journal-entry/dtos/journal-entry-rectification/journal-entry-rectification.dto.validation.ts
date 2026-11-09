import z from 'zod';

import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import journalLineError from '@domain/journal-entry/errors/journal-line.error';
import { EJournalEntrySourceType } from '@domain/journal-entry/types/journal-entry.types';

import { journalEntryAttachmentsUpdateReqValidation } from '@app/journal-entry/dtos/journal-entry/journal-entry-attachments.dto.validation';
import { journalLineReqValidation } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.validation';

const invalidEntryIdKey = new journalLineError.InvalidHeaderyEntryId().errorKey;
const invalidCounterpartyIdKey = new journalLineError.InvalidCounterpartyId()
  .errorKey;

const rectificationLineValidation = journalLineReqValidation.extend({
  id: z.uuid(invalidEntryIdKey).optional(),
});

const counterpartyLineValidation = rectificationLineValidation.extend({
  counterpartyId: z.uuid(invalidCounterpartyIdKey),
});

const transferLineValidation = rectificationLineValidation.omit({
  counterpartyId: true,
});

const baseShape = {
  attachments: journalEntryAttachmentsUpdateReqValidation,
  effectiveDate: z.date(new journalEntryError.InvalidEffectiveDate().errorKey),
  postedAt: z
    .date(new journalEntryError.InvalidPostingDate().errorKey)
    .nullable(),
  memo: z.string(new journalEntryError.InvalidMemo().errorKey).nullable(),
};

export const journalEntryRectificationReqValidation = z.discriminatedUnion(
  'sourceType',
  [
    z
      .object({
        ...baseShape,
        sourceType: z.literal(EJournalEntrySourceType.Payment),
        sourceLine: counterpartyLineValidation,
        destinationLines: z
          .array(counterpartyLineValidation)
          .min(1, new journalEntryError.InvalidLineItems().errorKey),
      })
      .strict(),
    z
      .object({
        ...baseShape,
        sourceType: z.literal(EJournalEntrySourceType.Receipt),
        sourceLines: z
          .array(counterpartyLineValidation)
          .min(1, new journalEntryError.InvalidLineItems().errorKey),
        destinationLine: counterpartyLineValidation,
      })
      .strict(),
    z
      .object({
        ...baseShape,
        sourceType: z.literal(EJournalEntrySourceType.Transfer),
        sourceLine: transferLineValidation,
        destinationLine: transferLineValidation,
        chargeLines: z.array(rectificationLineValidation),
      })
      .strict(),
  ]
);
