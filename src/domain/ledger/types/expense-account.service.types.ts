import { IReadRepoOptions } from '@shared/types/repo.types';
import { IEvent } from '@shared/values/events/types/event.types';

import { ILedgerAccountAudit } from './ledger-account-audit.types';
import { ILedgerAccount } from './ledger.types';

export default interface IExpenseAccountService {
  /** Activates draft expense accounts beneath active parents; active accounts return unchanged; returns state, events and audit without writes. */
  activate(
    account: ILedgerAccount,
    repoOptions: IReadRepoOptions
  ): Promise<
    [ILedgerAccount, IEvent<ILedgerAccount>[], ILedgerAccountAudit | null]
  >;

  /** Rejects non-expense and archived accounts; returns an audited name change or an unchanged account with no events/audit. Never persists. */
  update(
    account: ILedgerAccount,
    payload: { name: string }
  ): [
    Readonly<ILedgerAccount>,
    IEvent<ILedgerAccount>[],
    ILedgerAccountAudit | null,
  ];
}
