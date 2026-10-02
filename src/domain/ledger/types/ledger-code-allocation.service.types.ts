import {
  IReadRepoOptions,
  ITransactionContext,
} from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { ILedgerAccount } from './ledger.types';

export default interface ILedgerCodeAllocationService {
  /** Locks the family header and returns its next code; insert before releasing the transaction. */
  getNextCode(
    payload: {
      accountingEntityId: TEntityId;
      type: ILedgerAccount['type'];
      subType: ILedgerAccount['subType'];
      allocationHeaderCode: string;
    },
    repoOptions: IReadRepoOptions & { tx: ITransactionContext }
  ): Promise<string>;
}
