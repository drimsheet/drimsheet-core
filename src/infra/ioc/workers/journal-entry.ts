import makeJournalEntryExtractionWorker from '@app/journal-entry/workers/journal-entry-extraction.worker';

import { extractJournalEntryUseCase } from '@infra/ioc/usecases/journal-entry';

export const journalEntryExtractionWorker = makeJournalEntryExtractionWorker({
  usecase: extractJournalEntryUseCase,
});
