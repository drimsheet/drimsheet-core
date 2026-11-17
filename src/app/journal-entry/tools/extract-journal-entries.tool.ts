import { IAgentTool } from '@shared/types/ai.types';

import {
  IJournalEntriesExtractionInput,
  IJournalEntryExtractionAiResponse,
} from '@app/journal-entry/dtos/journal-entry-extraction/journal-entry-extraction.dto';
import { journalEntriesExtractionInputValidation } from '@app/journal-entry/dtos/journal-entry-extraction/journal-entry-extraction.dto.validation';

interface IDependencies {
  structuredLlmCall: (
    input: IJournalEntriesExtractionInput
  ) => Promise<IJournalEntryExtractionAiResponse>;
}

type TTool = IAgentTool<
  typeof journalEntriesExtractionInputValidation,
  IJournalEntryExtractionAiResponse
>;

export default function makeExtractJournalEntriesTool(
  deps: IDependencies
): TTool {
  const name = 'extract_journal_entries';
  // TODO: add a proper description
  const description = '';

  return {
    name,
    description,
    inputSchema: journalEntriesExtractionInputValidation,
    func: async (input) => {
      return await deps.structuredLlmCall(input);
    },
  };
}
