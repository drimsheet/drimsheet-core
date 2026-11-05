import stringUtils from '@shared/utils/string';

import journalLineError from '@domain/journal-entry/errors/journal-line.error';

export default function getJournalLineDescriptionHelper(value?: string | null) {
  if (!value) {
    return null;
  }

  return stringUtils.sanitizeAndValidate(
    value,
    {
      max: 100,
      min: 1,
    },
    journalLineError.InvalidDescription
  );
}
