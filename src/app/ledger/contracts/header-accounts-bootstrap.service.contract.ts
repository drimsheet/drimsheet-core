import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';

import { ILedgerAccountBootstrapResult } from '@app/ledger/contracts/ledger-account-bootstrap.types';

/**
 *
 * @param deprecated: setup should be done from API level
 */
export default interface IHeaderAccountsBootstrapService {
  /** Rejects immediately when any domain account creation rejects. */

  /**
   *
   * @param deprecated: setup should be done from API level
   */
  bootstrap(
    accountingEntity: IAccountingEntity,
    createdBy: TEntityId,
    repoOptions: IReadRepoOptions
  ): Promise<ILedgerAccountBootstrapResult>;
}
