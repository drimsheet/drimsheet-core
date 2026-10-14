import { ICounterparty } from '@domain/counterparty/types/counterparty.types';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import { IJournalLine } from '@domain/journal-entry/types/journal-line.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';

/** Resolves journal entry lines to their accounts and optional counterparties, rejecting missing references without changing the stored lines. */
export default function getJournalEntryLinesHelper(
  lines: IJournalLine[],
  accounts: ILedgerAccount[],
  counterparties: (ICounterparty | null)[]
) {
  return lines.map((line) => {
    const account = accounts.find(
      (candidate) => candidate.id === line.accountId
    );
    if (!account) {
      throw new journalEntryError.AccountNotFound({
        accountId: line.accountId,
      });
    }
    const counterparty =
      counterparties.find(
        (candidate) => candidate?.id === line.counterpartyId
      ) ?? null;
    const isMissingCounterparty =
      line.counterpartyId !== null && counterparty === null;
    if (isMissingCounterparty) {
      throw new journalEntryError.InvalidCounterpartyId({
        counterpartyId: line.counterpartyId,
      });
    }
    return { ...line, account, counterparty };
  });
}
