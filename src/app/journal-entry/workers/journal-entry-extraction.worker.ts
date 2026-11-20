import zodValidationRunner from '@shared/utils/zod-validation-runner';

import { IJournalEntryExtractionDto } from '@app/ai/dtos/journal-entry-extraction/journal-entry-extraction.dto';
import { journalEntryExtractionDtoValidation } from '@app/ai/dtos/journal-entry-extraction/journal-entry-extraction.dto.validation';

export default function makeJournalEntryExtractionWorker() {
  return async (payload: IJournalEntryExtractionDto): Promise<void> => {
    zodValidationRunner(journalEntryExtractionDtoValidation, payload);

    // TODO: Start the journal-entry extraction workflow.
  };
}
