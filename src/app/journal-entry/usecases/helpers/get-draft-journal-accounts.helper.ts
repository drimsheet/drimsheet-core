import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { TDraftJournalLinePatch } from '@domain/journal-entry/types/journal-entry.service.types';
import { IJournalLine } from '@domain/journal-entry/types/journal-line.types';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';

interface IGetDraftJournalAccountsPayload {
  accountingEntityId: TEntityId;
  storedLines: readonly Pick<IJournalLine, 'accountId'>[];
  requestedLines: readonly Pick<TDraftJournalLinePatch, 'accountId'>[];
  repo: ILedgerAccountRepo;
  repoOptions: IReadRepoOptions;
}

/** Fetches distinct account references for validation of the resulting draft. */
export default function getDraftJournalAccountsHelper({
  accountingEntityId,
  storedLines,
  requestedLines,
  repo,
  repoOptions,
}: IGetDraftJournalAccountsPayload) {
  const accountIds = [
    ...new Set([
      ...storedLines.map((line) => line.accountId),
      ...requestedLines.flatMap((line) =>
        line.accountId ? [line.accountId] : []
      ),
    ]),
  ];

  return repo.findAllByIds(accountIds, accountingEntityId, repoOptions);
}
