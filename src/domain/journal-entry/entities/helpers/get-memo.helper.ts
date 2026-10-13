import stringUtils from '@shared/utils/string';

import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';

export default function getJournalEntryMemo(value?: string | null) {
  if (!value) {
    return null;
  }

  return stringUtils.sanitizeAndValidate(
    value,
    {
      max: 250,
      min: 1,
    },
    journalEntryError.InvalidMemo
  );
}
