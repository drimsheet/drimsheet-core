import z from 'zod';

import { TEntityId } from '@shared/types/uuid';
import { IFileAttachment } from '@shared/values/file-attachments/types/file-attachment.types';

import type { IProposedJournalEntriesResult } from '@app/ai/dtos/proposed-journal-entries/proposed-journal-entries.dto';
import { IAgentTool } from '@app/ai/types/agent-tool';

interface IDependencies {
  usecase: (
    file: IFileAttachment,
    contextId: TEntityId
  ) => Promise<IProposedJournalEntriesResult>;
  contextId: TEntityId;
  file: IFileAttachment;
}

const inputSchema = z.strictObject({});

type TTool = IAgentTool<
  typeof inputSchema,
  Awaited<ReturnType<IDependencies['usecase']>>
>;

export default function makeProposeJournalEntriesTool(
  deps: IDependencies
): TTool {
  return {
    name: 'propose_journal_entries',
    description:
      'Extract and save proposed journal entries, ledger accounts, and counterparties from the file bound to the current agent run.',
    inputSchema,
    annotations: { readOnlyHint: false },
    func: () => deps.usecase(deps.file, deps.contextId),
  };
}
