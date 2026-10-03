import { getJournalEntriesQueryValidationSchema } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.validation';

import mcpHandlers from '@infra/ioc/handlers/mcp';
import { getJournalEntriesUseCase } from '@infra/ioc/usecases/journal-entry';

import toToolResultHelper from '@interface/mcp/helpers/to-tool-result.helper';
import IMcpTool from '@interface/mcp/types/mcp-tool.types';

type TTool = IMcpTool<typeof getJournalEntriesQueryValidationSchema>;

const name = 'get_journal_entries';

const description =
  'List journal entries in the current accounting-entity context. Filter by account, counterparty, posted/archived status, or search; paginate and sort with the query fields. Defaults to 10 results, maximum 200 per page. Money amounts use minor units with their currency code.';

const func: TTool['func'] = async (query) => {
  try {
    const journalEntries = await getJournalEntriesUseCase(query);
    return toToolResultHelper(journalEntries);
  } catch (error) {
    return mcpHandlers.error(error);
  }
};

/** Expose the existing journal read with MCP serialization and safe errors. */
const getJournalEntriesTool: TTool = {
  name,
  description,
  inputSchema: getJournalEntriesQueryValidationSchema,
  annotations: { readOnlyHint: true },
  func,
};

export default getJournalEntriesTool;
