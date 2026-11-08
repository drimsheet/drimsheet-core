import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';

interface IGetJournalAccountsPayload {
  accountingEntityId: TEntityId;
  lines: readonly { accountId?: string }[];
  repo: ILedgerAccountRepo;
  repoOptions: IReadRepoOptions;
}

/** Fetches distinct account references from complete lines or line patches. */
export default function getJournalAccountsHelper({
  accountingEntityId,
  lines,
  repo,
  repoOptions,
}: IGetJournalAccountsPayload) {
  const accountIds = [
    ...new Set(
      lines.flatMap((line) =>
        line.accountId ? [line.accountId as TEntityId] : []
      )
    ),
  ];

  return repo.findAllByIds(accountIds, accountingEntityId, repoOptions);
}
