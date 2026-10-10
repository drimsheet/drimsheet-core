import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
  IJournalEntry,
} from '@domain/journal-entry/types/journal-entry.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';

function validateSourceType(entry: IJournalEntry) {
  if (entry.sourceType === EJournalEntrySourceType.OpeningBalance) {
    return;
  }

  throw new journalEntryError.RectificationNotPermitted({
    journalEntryId: entry.id,
    sourceType: entry.sourceType,
  });
}

function validateStatus(entry: IJournalEntry) {
  if (entry.status === EJournalEntryStatus.Draft) {
    return;
  }

  throw new journalEntryError.RectificationNotPermitted({
    journalEntryId: entry.id,
    status: entry.status,
  });
}

function validateAccountAssociation(
  entry: IJournalEntry,
  account: Pick<ILedgerAccount, 'id'>
) {
  const hasAccountLine = entry.lines.some(
    (line) => line.accountId === account.id
  );

  if (hasAccountLine) {
    return;
  }

  throw new journalEntryError.RectificationNotPermitted({
    journalEntryId: entry.id,
    accountId: account.id,
  });
}

/** Requires every revised line to retain a corresponding original sequence. */
function validateLineSequences(
  originalEntry: IJournalEntry,
  revisedEntry: IJournalEntry
) {
  const hasMissingSequence = revisedEntry.lines.some(
    (line) =>
      !originalEntry.lines.some(
        (original) => original.sequenceOrder === line.sequenceOrder
      )
  );
  if (hasMissingSequence) {
    throw new journalEntryError.MismatchedJournalLines({
      journalEntryId: originalEntry.id,
    });
  }
}

const openingBalanceRevisionValidation = Object.freeze({
  validateSourceType,
  validateStatus,
  validateAccountAssociation,
  validateLineSequences,
});

export default openingBalanceRevisionValidation;
