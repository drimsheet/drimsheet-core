import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IJournalEntry } from '@domain/journal-entry/types/journal-entry.types';

interface IValidateJournalEntryMutationPayload {
  id: string;
  entry: IJournalEntry | null;
  accountingEntityId: TEntityId;
}

// TODO: Rename this value-returning validation to a check; reserve validate
// for checks that only throw on failure and return no value.
function validate(
  payload: IValidateJournalEntryMutationPayload
): IJournalEntry {
  const { id, entry, accountingEntityId } = payload;

  if (entry?.accountingEntityId !== accountingEntityId) {
    throw new appError.ResourceNotFound({ id });
  }

  return entry;
}

const journalEntryMutationPolicy = Object.freeze({ validate });

export default journalEntryMutationPolicy;
