import { IWriteRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { ILedgerAccountHistory } from '@domain/ledger/types/ledger-account-audit.types';

export default interface ILedgerAccountHistoryRepo {
  deleteByAccountId(id: TEntityId, options: IWriteRepoOptions): Promise<void>;

  save(
    histories: ILedgerAccountHistory | ILedgerAccountHistory[],
    options: IWriteRepoOptions
  ): Promise<void>;
}
