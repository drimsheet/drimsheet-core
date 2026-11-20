import { TEntityId } from '@shared/types/uuid';

import { journalEntriesExtractionInputValidation } from '@app/ai/dtos/journal-entry-extraction/journal-entry-extraction.dto.validation';
import { IAgentTool } from '@app/ai/types/agent-tool';
import type makeProposeJournalEntriesUsecase from '@app/ai/usecases/propose-journal-entries.usecase';

interface IDependencies {
  usecase: ReturnType<typeof makeProposeJournalEntriesUsecase>;
  contextId: TEntityId;
}

type TTool = IAgentTool<
  typeof journalEntriesExtractionInputValidation,
  Awaited<ReturnType<IDependencies['usecase']>>
>;

export default function makeProposeJournalEntriesTool(
  deps: IDependencies
): TTool {
  return {
    name: 'propose_journal_entries',
    description:
      'Propose journal entries, ledger accounts, and counterparties from text or a file attachment and save the proposals for the current agent run.',
    inputSchema: journalEntriesExtractionInputValidation,
    annotations: { readOnlyHint: false },
    func: (input) => deps.usecase(input, deps.contextId),
  };
}
