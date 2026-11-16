import { IJournalEntryExtractionDto } from '@app/journal-entry/dtos/journal-entry-extraction/journal-entry-extraction.dto';

export const JOURNAL_ENTRY_EXTRACTION_QUEUE_NAME =
  'journal-entry-extraction-queue' as const;

export default interface IJournalEntryExtractionQueue {
  /** Rejects if the extraction job cannot be enqueued. */
  add(
    correlationId: string,
    payload: IJournalEntryExtractionDto
  ): Promise<void>;
}
