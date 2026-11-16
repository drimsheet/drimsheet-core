import { IAgentTool } from '@shared/types/ai.types';

import { getJournalEntriesQueryValidationSchema } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.validation';
import type makeGetJournalEntriesUsecase from '@app/journal-entry/usecases/get-journal-entries.usecase';

interface IDependencies {
  usecase: ReturnType<typeof makeGetJournalEntriesUsecase>;
}

type TTool = IAgentTool<
  typeof getJournalEntriesQueryValidationSchema,
  Awaited<ReturnType<IDependencies['usecase']>>
>;

const name = 'get_journal_entries';

const description =
  'List journal entries in the current accounting-entity context. Filter by account, counterparty, posted/archived status, or search; paginate and sort with the query fields. Defaults to 10 results, maximum 200 per page. Money amounts use minor units with their currency code.';

export default function makeGetJournalEntriesTool(deps: IDependencies): TTool {
  return {
    name,
    description,
    inputSchema: getJournalEntriesQueryValidationSchema,
    annotations: { readOnlyHint: true },
    func: deps.usecase,
  };
}
