import { IReadRepoOptions } from '@shared/types/repo.types';

import { ILedgerAccount, TAuditedLedgerAccount } from './ledger.types';

export default interface ILedgerAccountArchiveService {
  /** Rejects headers and accounts beneath draft parents; returns changed audited accounts target-first, or [] for an already archived account. Fetches descendants only for controls; never re-fetches the target or persists. */
  archive(
    account: ILedgerAccount,
    repoOptions: IReadRepoOptions
  ): Promise<TAuditedLedgerAccount[]>;
}
