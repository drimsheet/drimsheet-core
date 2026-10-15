import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { ILedgerAccount, ULedgerType } from '@domain/ledger/types/ledger.types';

export default interface ILedgerAccountQueryRepo {
  /** Returns the complete class across statuses, ordered by materialized path. */
  findChartOfAccounts(
    accountingEntityId: TEntityId,
    type: ULedgerType,
    options: IReadRepoOptions
  ): Promise<ILedgerAccount[]>;

  /** Returns all direct children, across statuses, ordered by materialized path. */
  findSubAccounts(
    accountId: TEntityId,
    accountingEntityId: TEntityId,
    options: IReadRepoOptions
  ): Promise<ILedgerAccount[]>;
}
