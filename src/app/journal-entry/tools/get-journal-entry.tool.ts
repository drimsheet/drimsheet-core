import z from 'zod';

import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';

import { IAgentTool } from '@app/ai/types/agent-tool';
import type { IJournalEntryListDto } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';

const inputSchema = z.object({
  id: z.uuid(new journalEntryError.InvalidJournalEntry().errorKey),
});

interface IDependencies {
  usecase: (id: string) => Promise<IJournalEntryListDto>;
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
