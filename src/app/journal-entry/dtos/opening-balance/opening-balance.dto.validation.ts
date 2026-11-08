import z from 'zod';

import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';

import fileAppError from '@app/file/errors/file.error';
import fileUploadPolicy from '@app/file/policies/file-upload.policy';
import { EFileUploadPurpose } from '@app/file/types/file.types';
import {
  exchangeRateDtoValidation,
  exchangeRateJsonDtoValidation,
} from '@app/money/dtos/exchange-rate/exchange-rate.dto.validation';
import { moneyDtoValidation } from '@app/money/dtos/money/money.dto.validation';

export const openingBalanceDtoValidation = z.object({
  amount: moneyDtoValidation,
  exchangeRate: exchangeRateDtoValidation.nullable(),
  date: z
    .date(new journalEntryError.InvalidOpeningBalanceDate().errorKey)
    .refine((value) => value.getTime() <= Date.now(), {
      message: new journalEntryError.InvalidOpeningBalanceDate().errorKey,
    }),
});

export const openingBalanceCreationReqValidation = z.object({
  ...openingBalanceDtoValidation.shape,
  accountId: z.uuid(new ledgerAccountError.InvalidId().errorKey),
});

const invalidAttachmentReferenceKey = new fileAppError.InvalidUploadReference()
  .errorKey;
const maxAttachmentReferences = fileUploadPolicy.getPolicy(
  EFileUploadPurpose.JournalEntryAttachment
).maxFiles;

export const updateDraftOpeningBalanceReqValidation = z.strictObject({
  amount: openingBalanceDtoValidation.shape.amount.optional(),
  effectiveDate: z
    .date(new journalEntryError.InvalidEffectiveDate().errorKey)
    .optional(),
  exchangeRate: openingBalanceDtoValidation.shape.exchangeRate.optional(),
  memo: z
    .string(new journalEntryError.InvalidMemo().errorKey)
    .nullable()
    .optional(),
  attachmentReferences: z
    .array(z.uuid(invalidAttachmentReferenceKey))
    .max(
      maxAttachmentReferences,
      new fileAppError.InvalidUploadCount().errorKey
    )
    .refine(
      (references) => new Set(references).size === references.length,
      invalidAttachmentReferenceKey
    )
    .optional(),
});

export const openingBalanceJsonDtoValidation =
  openingBalanceDtoValidation.extend({
    date: z.iso
      .datetime({
        offset: true,
        error: new journalEntryError.InvalidOpeningBalanceDate().errorKey,
      })
      .transform((value) => new Date(value))
      .pipe(openingBalanceDtoValidation.shape.date),
    exchangeRate: exchangeRateJsonDtoValidation.nullable(),
  });

export const openingBalanceCreationJsonReqValidation =
  openingBalanceCreationReqValidation.extend({
    date: openingBalanceJsonDtoValidation.shape.date,
    exchangeRate: openingBalanceJsonDtoValidation.shape.exchangeRate,
  });
