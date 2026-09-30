import z from 'zod';

import fileAttachmentError from '@shared/values/file-attachments/file-attachment.error';

import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import journalLineError from '@domain/journal-entry/errors/journal-line.error';
import { EJournalEntrySourceType } from '@domain/journal-entry/types/journal-entry.types';

import {
  counterpartyNameValidation,
  counterpartyTypeValidation,
} from '@app/counterparty/dtos/counterparty/counterparty.dto.validation';
import { journalLineReqValidation } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.validation';

const invalidEntryIdKey = new journalLineError.InvalidHeaderyEntryId().errorKey;
const invalidCounterpartyIdKey = new journalLineError.InvalidCounterpartyId()
  .errorKey;

const rectificationLineValidation = journalLineReqValidation.extend({
  id: z.uuid(invalidEntryIdKey).optional(),
});

const counterpartyLineValidation = rectificationLineValidation.extend({
  counterparty: z.object({
    id: z.uuid(invalidCounterpartyIdKey).optional(),
    name: counterpartyNameValidation,
    type: counterpartyTypeValidation.optional(),
  }),
});

const transferLineValidation = rectificationLineValidation.omit({
  counterparty: true,
});

const attachmentValidation = z
  .object({
    url: z.url(new fileAttachmentError.InvalidUrl().errorKey),
    name: z
      .string(new fileAttachmentError.InvalidName().errorKey)
      .min(1, new fileAttachmentError.InvalidName().errorKey),
    type: z
      .string(new fileAttachmentError.InvalidType().errorKey)
      .min(1, new fileAttachmentError.InvalidType().errorKey),
    size: z
      .number(new fileAttachmentError.InvalidSize().errorKey)
      .int()
      .nonnegative(),
  })
  .strict();

const baseShape = {
  expectedVersion: z.number().int().positive(),
  attachments: z.array(attachmentValidation),
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
