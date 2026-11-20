import { IJournalEntryExtractionDto } from '@app/ai/dtos/journal-entry-extraction/journal-entry-extraction.dto';

export const JOURNAL_ENTRY_EXTRACTION_QUEUE_NAME =
  'journal-entry-extraction-queue' as const;

export default interface IJournalEntryExtractionQueue {
  /**
   * Enqueues PDF text or a claimed attachment with its accounting context.
   * Rejects if the job cannot be enqueued.
   */
  add(payload: IJournalEntryExtractionDto): Promise<void>;
}
