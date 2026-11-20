import makeJournalEntryExtractionWorker from '@app/ai/workers/journal-entry-extraction.worker';

import { agentContextAppService } from '@infra/ioc/services/ai';

export const journalEntryExtractionWorker = makeJournalEntryExtractionWorker({
  agentContextAppService,
});
