import { IEvent } from '@shared/values/events/types/event.types';

import { ILedgerAccountAudit } from './ledger-account-audit.types';
import { ILedgerAccount } from './ledger.types';

export default interface IRevenueAccountService {
  /** Rejects non-revenue and archived accounts; returns an audited name change or an unchanged account with no events/audit. Never persists. */
  update(
    account: ILedgerAccount,
    payload: { name: string }
  ): [
    Readonly<ILedgerAccount>,
    IEvent<ILedgerAccount>[],
    ILedgerAccountAudit | null,
  ];
}
