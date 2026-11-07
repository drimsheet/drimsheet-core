import { IJournalEntryRectificationResult } from '@domain/journal-entry/types/journal-entry-rectification.types';
import {
  EJournalEntryRectificationMode,
  EJournalEntryStatus,
  IJournalEntry,
} from '@domain/journal-entry/types/journal-entry.types';

/**
 * Selects the reversing entry and eligible posted current entry for balance
 * propagation. Metadata-only changes do not propagate the current entry.
 */
export default function getJournalEntriesForBalancePropagationHelper(
  result: IJournalEntryRectificationResult
): IJournalEntry[] {
  const entries: IJournalEntry[] = [];

  if (result.reversingJournalEntry) {
    entries.push(result.reversingJournalEntry);
  }

  const shouldPropagateCurrentEntry =
    result.currentJournalEntry.status === EJournalEntryStatus.Posted &&
    result.mode !== EJournalEntryRectificationMode.UpdateMeta;

  if (shouldPropagateCurrentEntry) {
    entries.push(result.currentJournalEntry);
  }

  return entries;
}
