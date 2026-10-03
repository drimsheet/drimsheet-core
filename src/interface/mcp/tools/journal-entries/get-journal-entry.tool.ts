import z from 'zod';

import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';

import mcpHandlers from '@infra/ioc/handlers/mcp';
import { getJournalEntryUseCase } from '@infra/ioc/usecases/journal-entry';

import toToolResultHelper from '@interface/mcp/helpers/to-tool-result.helper';
import IMcpTool from '@interface/mcp/types/mcp-tool.types';

const inputSchema = z.object({
  id: z.uuid(new journalEntryError.InvalidJournalEntry().errorKey),
});

type TTool = IMcpTool<typeof inputSchema>;

const name = 'get_journal_entry';

const description =
  'Get one journal entry by ID, including its lines, in the current accounting-entity context. Monetary results use minor units.';

const func: TTool['func'] = async (input) => {
  try {
    const journalEntry = await getJournalEntryUseCase(input.id);
    return toToolResultHelper(journalEntry);
  } catch (error) {
    return mcpHandlers.error(error);
  }
};

const getJournalEntryTool: TTool = {
  name,
  description,
  inputSchema: inputSchema,
  annotations: { readOnlyHint: true },
  func,
};

export default getJournalEntryTool;
