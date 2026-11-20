import makeJournalEntryExtractionWorker from '@app/ai/workers/journal-entry-extraction.worker';

import { createAgentRunContextUseCase } from '@infra/ioc/usecases/ai';

export const journalEntryExtractionWorker = makeJournalEntryExtractionWorker({
  createAgentRunContextUseCase,
});
