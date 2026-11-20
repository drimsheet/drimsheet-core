import z from 'zod';

import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';

import { IAgentTool } from '@app/ai/types/agent-tool';
import type makeGetJournalEntryUsecase from '@app/journal-entry/usecases/get-journal-entry.usecase';

const inputSchema = z.object({
  id: z.uuid(new journalEntryError.InvalidJournalEntry().errorKey),
});

interface IDependencies {
  usecase: ReturnType<typeof makeGetJournalEntryUsecase>;
}

type TTool = IAgentTool<
  typeof inputSchema,
  Awaited<ReturnType<IDependencies['usecase']>>
>;

const name = 'get_journal_entry';

const description =
  'Get one journal entry by ID, including its lines, in the current accounting-entity context. Monetary results use minor units.';

export default function makeGetJournalEntryTool(deps: IDependencies): TTool {
  return {
    name,
    description,
    inputSchema: inputSchema,
    annotations: { readOnlyHint: true },
    func: (input) => deps.usecase(input.id),
  };
}
