import z from 'zod';

import { addressDtoValidation } from '@shared/values/contact-details/dto/address.dto.validation';

import accountingError from '@domain/accounting/errors/accounting.error';
import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import { ECounterpartyRole } from '@domain/counterparty/types/counterparty.types';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import { ENormalBalance } from '@domain/ledger/types/ledger.types';
import actorError from '@domain/user/errors/actor.error';

import {
  counterpartyCreateReqValidation,
  counterpartyNameValidation,
  counterpartyTypeValidation,
} from '@app/counterparty/dtos/counterparty/counterparty.dto.validation';
import { fileAttachmentDtoValidation } from '@app/file/dtos/file-attachment/file-attachment.dto.validation';
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
  IJournalEntriesExtractionInput,
  IJournalEntryExtractionAiResponse,
  IJournalEntryExtractionDto,
} from './journal-entry-extraction.dto';

export const journalEntryExtractionDtoValidation = z.strictObject({
  accountId: journalEntryUploadReqValidation.shape.accountId,
  sourceType: journalEntryUploadReqValidation.shape.sourceType,
  actorId: z.uuid(new actorError.InvalidId().errorKey),
  accountingEntityId: z.uuid(
    new accountingError.InvalidAccountingEntityId().errorKey
  ),
  file: fileAttachmentDtoValidation,
}) satisfies z.ZodType<IJournalEntryExtractionDto>;

export const journalEntriesExtractionInputValidation = z.strictObject({
  value: fileAttachmentDtoValidation.or(z.string()),
}) satisfies z.ZodType<IJournalEntriesExtractionInput>;

const undeterminedValidation = z.literal('__undetermined__');

/** Validates an extracted value together with its confidence and evidence. */
function aiAssessmentValidation<T extends z.ZodType>(valueValidation: T) {
  return z.strictObject({
    value: valueValidation.or(undeterminedValidation),
    confidence: z.number(),
    evidence: z.array(z.string()),
  });
}

const extractionAddressValidation = z.strictObject({
  ...addressDtoValidation.shape,
  line2: addressDtoValidation.shape.line2.unwrap().nullable(),
  region: addressDtoValidation.shape.region.unwrap().nullable(),
  postalCode: addressDtoValidation.shape.postalCode.unwrap().nullable(),
});

const createRoleDetailsValidation =
  counterpartyCreateReqValidation.shape.roleDetails.unwrap();
const employerDetailsValidation =
  createRoleDetailsValidation.shape.employer.unwrap();

const extractionRoleDetailsValidation = z.strictObject({
  employer: z
    .strictObject({
      ...employerDetailsValidation.shape,
      displayName: employerDetailsValidation.shape.displayName.nonoptional(),
      address: extractionAddressValidation,
    })
    .optional(),
  vendor: z
    .strictObject({ address: extractionAddressValidation.nullable() })
    .optional(),
  contractor: z
    .strictObject({ address: extractionAddressValidation })
    .optional(),
});

const extractionLedgerAccountValidation = z.strictObject({
  temporaryId: z.string(),
  name: z.string(),
  type: ledgerAccountTypeValidation.or(undeterminedValidation),
  normalBalance: z
    .enum(
      ENormalBalance,
      new ledgerAccountError.InvalidNormalBalance().errorKey
    )
    .or(undeterminedValidation),
  subType: ledgerAccountSubTypeValidation.or(undeterminedValidation),
  behavior: ledgerAccountBehaviorValidation.or(undeterminedValidation),
});

const extractionCounterpartyValidation = z.strictObject({
  temporaryId: z.string(),
  name: counterpartyNameValidation.or(undeterminedValidation),
  type: counterpartyTypeValidation.or(undeterminedValidation),
  roles: z
    .array(
      z.enum(ECounterpartyRole, new counterpartyError.InvalidRole().errorKey)
    )
    .or(undeterminedValidation),
  roleDetails: extractionRoleDetailsValidation,
});

const extractionEntryValidation = z.strictObject({
  temporaryId: z.string(),
  sourceType: journalEntrySourceTypeValidation.or(undeterminedValidation),
  memo: z.string(new journalEntryError.InvalidMemo().errorKey).nullable(),
  effectiveDate: z.iso
    .date(new journalEntryError.InvalidEffectiveDate().errorKey)
    .or(undeterminedValidation),
  lines: z.array(
    z.strictObject({
      temporaryId: z.string(),
      accountTemporaryId: z.string(),
      sequenceOrder: journalLineReqValidation.shape.sequenceOrder,
      amount: moneyDtoValidation.or(undeterminedValidation),
      exchangeRate: exchangeRateDtoValidation
        .nullable()
        .or(undeterminedValidation),
      side: journalEntrySideValidation.or(undeterminedValidation),
      description: journalLineReqValidation.shape.description,
      counterpartyTemporaryId: z.string().nullable(),
      functionalAmount: moneyDtoValidation.or(undeterminedValidation),
    })
  ),
});

export const journalEntryExtractionAiResponseValidation = z.strictObject({
  ledgerAccounts: z.array(
    aiAssessmentValidation(extractionLedgerAccountValidation)
  ),
  counterparties: z.array(
    aiAssessmentValidation(extractionCounterpartyValidation)
  ),
  entries: z.array(aiAssessmentValidation(extractionEntryValidation)),
}) satisfies z.ZodType<IJournalEntryExtractionAiResponse>;
