import z from 'zod';

import stringUtils from '@shared/utils/string';
import { addressDtoValidation } from '@shared/values/contact-details/dto/address.dto.validation';
import fileAttachmentError from '@shared/values/file-attachments/file-attachment.error';
import getFileAttachmentTypeHelper from '@shared/values/file-attachments/helpers/get-file-attachment-type.helper';

import accountingError from '@domain/accounting/errors/accounting.error';
import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import { ECounterpartyRole } from '@domain/counterparty/types/counterparty.types';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import { ENormalBalance } from '@domain/ledger/types/ledger.types';
import actorError from '@domain/user/errors/actor.error';

import {
  aiAssessmentDtoValidation,
  aiAssessmentValueValidation,
} from '@app/ai/dtos/assessment/assessment.dto.validation';
import aiAppError from '@app/ai/errors/ai.error';
import {
  counterpartyNameValidation,
  counterpartyTypeValidation,
} from '@app/counterparty/dtos/counterparty/counterparty.dto.validation';
import { journalEntryUploadReqValidation } from '@app/journal-entry/dtos/journal-entry-upload/journal-entry-upload.dto.validation';
import {
  journalEntrySideValidation,
  journalEntrySourceTypeValidation,
  journalLineReqValidation,
} from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.validation';
import {
  ledgerAccountBehaviorValidation,
  ledgerAccountSubTypeValidation,
  ledgerAccountTypeValidation,
} from '@app/ledger/dtos/ledger-account/ledger-account.dto.validation';
import { exchangeRateDtoValidation } from '@app/money/dtos/exchange-rate/exchange-rate.dto.validation';
import { moneyDtoValidation } from '@app/money/dtos/money/money.dto.validation';

import {
  IJournalEntryExtractionAiResponse,
  IJournalEntryExtractionDto,
} from './journal-entry-extraction.dto';

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

const invalidTemporaryIdKey = new aiAppError.InvalidTemporaryId().errorKey;
const invalidRoleDetailsKey = new counterpartyError.InvalidRoleDetails()
  .errorKey;
const invalidDateKey = new journalEntryError.InvalidEffectiveDate().errorKey;

const temporaryIdValidation = z
  .string(invalidTemporaryIdKey)
  .trim()
  .min(1, invalidTemporaryIdKey);

const ledgerAccountValidation = z.object({
  temporaryId: temporaryIdValidation,
  name: aiAssessmentValueValidation(
    z.string(new ledgerAccountError.InvalidName().errorKey)
  ),
  type: aiAssessmentValueValidation(ledgerAccountTypeValidation),
  normalBalance: aiAssessmentValueValidation(
    z.enum(
      ENormalBalance,
      new ledgerAccountError.InvalidNormalBalance().errorKey
    )
  ),
  subType: aiAssessmentValueValidation(ledgerAccountSubTypeValidation),
  behavior: aiAssessmentValueValidation(ledgerAccountBehaviorValidation),
});

const addressValidation = addressDtoValidation.extend({
  line2: addressDtoValidation.shape.line2.unwrap().nullable(),
  region: addressDtoValidation.shape.region.unwrap().nullable(),
  postalCode: addressDtoValidation.shape.postalCode.unwrap().nullable(),
});

const counterpartyValidation = z.object({
  temporaryId: temporaryIdValidation,
  name: aiAssessmentValueValidation(counterpartyNameValidation),
  type: aiAssessmentValueValidation(counterpartyTypeValidation),
  roles: aiAssessmentValueValidation(
    z.array(
      z.enum(ECounterpartyRole, new counterpartyError.InvalidRole().errorKey)
    )
  ),
  roleDetails: z.object(
    {
      employer: z
        .object({
          displayName: z.string().nullable(),
          address: addressValidation,
        })
        .optional(),
      vendor: z.object({ address: addressValidation.nullable() }).optional(),
      contractor: z.object({ address: addressValidation }).optional(),
    },
    invalidRoleDetailsKey
  ),
});

const entryValidation = z.object({
  temporaryId: temporaryIdValidation,
  sourceType: aiAssessmentValueValidation(journalEntrySourceTypeValidation),
  memo: z.string().nullable(),
  effectiveDate: aiAssessmentValueValidation(
    z.union([
      z.iso.date(invalidDateKey),
      z.iso.datetime({ offset: true, error: invalidDateKey }),
    ])
  ),
  lines: z.array(
    z.object({
      temporaryId: temporaryIdValidation,
      accountTemporaryId: aiAssessmentValueValidation(temporaryIdValidation),
      sequenceOrder: journalLineReqValidation.shape.sequenceOrder,
      amount: aiAssessmentValueValidation(moneyDtoValidation),
      exchangeRate: aiAssessmentValueValidation(
        exchangeRateDtoValidation.nullable()
      ),
      side: aiAssessmentValueValidation(journalEntrySideValidation),
      description: z.string().nullable(),
      counterpartyTemporaryId: aiAssessmentValueValidation(
        temporaryIdValidation.nullable()
      ),
      functionalAmount: aiAssessmentValueValidation(moneyDtoValidation),
    })
  ),
});

export const journalEntryExtractionAiResponseValidation = z.object({
  ledgerAccounts: z.array(aiAssessmentDtoValidation(ledgerAccountValidation)),
  counterparties: z.array(aiAssessmentDtoValidation(counterpartyValidation)),
  entries: z.array(aiAssessmentDtoValidation(entryValidation)),
}) satisfies z.ZodType<IJournalEntryExtractionAiResponse>;
