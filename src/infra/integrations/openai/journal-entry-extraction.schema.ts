import z from 'zod';

import { journalEntryExtractionAiResponseValidation } from '@app/journal-entry/dtos/journal-entry-extraction/journal-entry-extraction.dto.validation';
import { exchangeRateJsonDtoValidation } from '@app/money/dtos/exchange-rate/exchange-rate.dto.validation';

const responseShape = journalEntryExtractionAiResponseValidation.shape;
const counterpartyAssessmentValidation = responseShape.counterparties.element;
const counterpartyValidation =
  counterpartyAssessmentValidation.shape.value.options[0];
const roleDetailsShape = counterpartyValidation.shape.roleDetails.shape;

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

const entryAssessmentValidation = responseShape.entries.element;
const entryValidation = entryAssessmentValidation.shape.value.options[0];
const lineValidation = entryValidation.shape.lines.element;

const openAiJournalEntryExtractionValidation =
  journalEntryExtractionAiResponseValidation.extend({
    counterparties: z.array(
      counterpartyAssessmentValidation.extend({
        value: counterpartyValidation
          .extend({ roleDetails: roleDetailsValidation })
          .or(counterpartyAssessmentValidation.shape.value.options[1]),
      })
    ),
    entries: z.array(
      entryAssessmentValidation.extend({
        value: entryValidation
          .extend({
            lines: z.array(
              lineValidation.extend({
                exchangeRate: exchangeRateJsonDtoValidation
                  .nullable()
                  .or(lineValidation.shape.exchangeRate.options[1]),
              })
            ),
          })
          .or(entryAssessmentValidation.shape.value.options[1]),
      })
    ),
  });

export default openAiJournalEntryExtractionValidation;
