import { IWriteRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import { IEvent } from '@shared/values/events/types/event.types';

import { ILedgerAccountHistory } from '@domain/ledger/types/ledger-account-audit.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';

import { ILedgerCodeAssignmentPayload } from './ledger-code-assignment.service.contract';

export interface IAssignedLedgerAccount {
  account: ILedgerAccount;
  events: IEvent<ILedgerAccount>[];
}

export default interface ILedgerAccountPersistenceService {
  /** Assigns and persists within the supplied transaction, or a local transaction. */
  createAndAssignCode(
    payload: ILedgerCodeAssignmentPayload & { actorId: TEntityId },
    functionalCurrencyCode: string,
    repoOptions: IWriteRepoOptions<ILedgerAccountHistory[]>
  ): Promise<IAssignedLedgerAccount>;

  /**
   * Persists the account and initial balance atomically, preserving its code.
   * Supports header/bootstrap accounts with predefined codes.
   */
  createWithoutAssigningCode(
    account: ILedgerAccount,
    functionalCurrencyCode: string,
    repoOptions: IWriteRepoOptions<ILedgerAccountHistory[]>
  ): Promise<void>;
}
