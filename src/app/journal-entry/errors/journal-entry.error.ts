import { TErrorCause, TErrorKeys } from '@shared/types/error.types';
import errorUtils from '@shared/utils/error';
import appError from '@shared/values/errors/app.error';

const EErrorKeys = {
  ExtractionUnexpected: 'app_error_journal_entry_extraction_unexpected',
} as const satisfies TErrorKeys<'app_error_journal_entry'>;

type UJournalEntryError = (typeof EErrorKeys)[keyof typeof EErrorKeys];

class JournalEntryAppError extends appError.Base<UJournalEntryError> {
  constructor(key: UJournalEntryError, cause?: TErrorCause) {
    super(key, cause);
    this.name = 'JournalEntryAppError';
  }
}

const journalEntryAppError = Object.freeze({
  Base: JournalEntryAppError,
  ...errorUtils.getMappedErrors(EErrorKeys, JournalEntryAppError),
});

export default journalEntryAppError;
