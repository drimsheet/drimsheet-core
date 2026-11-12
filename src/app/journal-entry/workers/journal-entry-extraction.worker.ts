import { IJournalEntryExtractionDto } from '@app/journal-entry/dtos/journal-entry-extraction/journal-entry-extraction.dto';

interface IDependencies {
  usecase: (payload: IJournalEntryExtractionDto) => Promise<void>;
}

export default function makeJournalEntryExtractionWorker(deps: IDependencies) {
  return async (payload: IJournalEntryExtractionDto) => {
    await deps.usecase(payload);
  };
}
