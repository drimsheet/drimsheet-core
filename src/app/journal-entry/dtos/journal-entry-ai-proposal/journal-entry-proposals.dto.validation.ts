import z from 'zod';

import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';

import {
  journalEntrySideValidation,
  journalEntrySourceTypeValidation,
  journalLineReqValidation,
} from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.validation';

import {
  IJournalEntryAiProposal,
  IJournalHeaderAiProposal,
  IJournalLineAiProposal,
} from './journal-entry-proposals.dto';

const undeterminedValidation = z.literal('__undetermined__');
const journalLineFields = journalLineReqValidation.shape;

export const journalHeaderAiProposalDtoValidation = z.strictObject({
  temporaryId: z.string(),
  sourceType: journalEntrySourceTypeValidation.or(undeterminedValidation),
  memo: z.string(new journalEntryError.InvalidMemo().errorKey).nullable(),
  effectiveDate: z.iso
    .date(new journalEntryError.InvalidEffectiveDate().errorKey)
    .or(undeterminedValidation),
}) satisfies z.ZodType<IJournalHeaderAiProposal>;

export const journalLineAiProposalDtoValidation = z.strictObject({
  temporaryId: z.string(),
  accountTemporaryId: z.string(),
  sequenceOrder: journalLineFields.sequenceOrder,
  amount: journalLineFields.amount.or(undeterminedValidation),
  exchangeRate: journalLineFields.exchangeRate.or(undeterminedValidation),
  side: journalEntrySideValidation.or(undeterminedValidation),
  description: journalLineFields.description,
  counterpartyTemporaryId: z.string().nullable(),
  functionalAmount: journalLineFields.amount.or(undeterminedValidation),
}) satisfies z.ZodType<IJournalLineAiProposal>;

export const journalEntryAiProposalDtoValidation =
  journalHeaderAiProposalDtoValidation.extend({
    lines: z.array(journalLineAiProposalDtoValidation),
  }) satisfies z.ZodType<IJournalEntryAiProposal>;
