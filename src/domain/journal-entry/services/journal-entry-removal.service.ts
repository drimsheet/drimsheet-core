// TODO: audit this service; it feels like it's not doing enough to justify being a service

import journalEntryRemovalValidation from '@domain/journal-entry/services/validations/journal-entry-removal.validation';
import { IJournalEntryRectificationService } from '@domain/journal-entry/types/journal-entry-rectification.types';
import {
  EJournalEntryRemovalMode,
  IJournalEntryRemovalService,
} from '@domain/journal-entry/types/journal-entry-removal.types';
import { EJournalEntryStatus } from '@domain/journal-entry/types/journal-entry.types';

interface IDependencies {
  journalEntryRectificationService: IJournalEntryRectificationService;
}

/**
 * Selects and prepares the invariant-preserving removal behavior for a journal
 * entry without performing persistence or publishing events.
 */
function makePrepare(
  deps: IDependencies
): IJournalEntryRemovalService['prepare'] {
  return async (entry, actorId, repoOptions) => {
    journalEntryRemovalValidation.validateSourceType(entry);
    journalEntryRemovalValidation.validateState(entry);

    const shouldReverse =
      entry.status === EJournalEntryStatus.Posted ||
      (entry.status === EJournalEntryStatus.Archived &&
        entry.postedAt !== null);

    if (shouldReverse) {
      return Object.freeze({
        mode: EJournalEntryRemovalMode.Reverse,
        ...(await deps.journalEntryRectificationService.reverse(
          entry,
          actorId,
          repoOptions
        )),
      });
    }

    return Object.freeze({
      mode: EJournalEntryRemovalMode.Delete,
      originalJournalEntryId: entry.id,
    });
  };
}

export default function makeJournalEntryRemovalService(
  deps: IDependencies
): IJournalEntryRemovalService {
  return Object.freeze({
    // TODO: reevaluate this method's name
    prepare: makePrepare(deps),
  });
}
