import makeJournalEntryExtractionWorker from '@app/ai/workers/journal-entry-extraction.worker';

import {
  createAgentRunContextUseCase,
  proposeJournalEntriesUseCase,
} from '@infra/ioc/usecases/ai';

export const journalEntryExtractionWorker = makeJournalEntryExtractionWorker({
  createAgentRunContextUseCase,
  proposeJournalEntriesUseCase,
});
