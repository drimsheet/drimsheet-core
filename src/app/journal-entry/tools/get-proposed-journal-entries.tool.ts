import { TEntityId } from '@shared/types/uuid';

import { journalEntriesExtractionInputValidation } from '@app/ai/dtos/journal-entry-extraction/journal-entry-extraction.dto.validation';
import { IAgentTool } from '@app/ai/types/agent-tool';
import type makeGetProposedJournalEntriesUsecase from '@app/ai/usecases/get-proposed-journal-entries.usecase';

interface IDependencies {
  usecase: ReturnType<typeof makeGetProposedJournalEntriesUsecase>;
  contextId: TEntityId;
}

type TTool = IAgentTool<
  typeof journalEntriesExtractionInputValidation,
  Awaited<ReturnType<IDependencies['usecase']>>
>;

export default function makeGetProposedJournalEntriesTool(
  deps: IDependencies
): TTool {
  return {
    name: 'get_proposed_journal_entries',
    description:
      'Extract and save proposed journal entries, ledger accounts, and counterparties from text or a file attachment for the current agent run.',
    inputSchema: journalEntriesExtractionInputValidation,
    annotations: { readOnlyHint: false },
    func: (input) => deps.usecase(input, deps.contextId),
  };
}
