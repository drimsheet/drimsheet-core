import z from 'zod';

import { aiAssessmentValidation } from '@app/ai/dtos/ai-assessment/ai-assessment.dto.validation';
import { IJournalEntryExtractionAiResponse } from '@app/ai/dtos/journal-entry-extraction/journal-entry-extraction.dto';
import { counterpartyAiProposalDtoValidation } from '@app/counterparty/dtos/counterparty-ai-proposal/counterparty-ai-proposal.dto.validation';
import {
  journalEntryAiProposalDtoValidation,
  journalLineAiProposalDtoValidation,
} from '@app/journal-entry/dtos/journal-entry-ai-proposal/journal-entry-proposals.dto.validation';
import { ledgerAccountAiProposalDtoValidation } from '@app/ledger/dtos/ledger-account-ai-proposal/ledger-account-ai-proposal.dto.validation';
import { exchangeRateJsonDtoValidation } from '@app/money/dtos/exchange-rate/exchange-rate.dto.validation';

const roleDetailsShape =
  counterpartyAiProposalDtoValidation.shape.roleDetails.shape;

// Structured Outputs requires every property. Null denotes an absent role;
// parsing translates it back to the application's optional role details.
const roleDetailsValidation = z.strictObject({
  employer: roleDetailsShape.employer
    .unwrap()
    .nullable()
    .transform((value) => value ?? undefined),
  vendor: roleDetailsShape.vendor
    .unwrap()
    .nullable()
    .transform((value) => value ?? undefined),
  contractor: roleDetailsShape.contractor
    .unwrap()
    .nullable()
    .transform((value) => value ?? undefined),
});

const openAiCounterpartyProposalValidation =
  counterpartyAiProposalDtoValidation.extend({
    roleDetails: roleDetailsValidation,
  });

const openAiJournalLineProposalValidation =
  journalLineAiProposalDtoValidation.extend({
    exchangeRate: exchangeRateJsonDtoValidation
      .nullable()
      .or(z.literal('__undetermined__')),
  });

const openAiJournalEntryProposalValidation =
  journalEntryAiProposalDtoValidation.extend({
    lines: z.array(openAiJournalLineProposalValidation),
  });

const openAiJournalEntryExtractionValidation = z.strictObject({
  ledgerAccounts: z.array(
    aiAssessmentValidation(ledgerAccountAiProposalDtoValidation)
  ),
  counterparties: z.array(
    aiAssessmentValidation(openAiCounterpartyProposalValidation)
  ),
  entries: z.array(
    aiAssessmentValidation(openAiJournalEntryProposalValidation)
  ),
}) satisfies z.ZodType<IJournalEntryExtractionAiResponse>;

export default openAiJournalEntryExtractionValidation;
