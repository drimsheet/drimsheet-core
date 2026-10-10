import { IReadRepoOptions, IWriteRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IBankDetails } from '@domain/ledger/types/asset-account.types';

export default interface IBankAccountRepo {
  findOne(
    bankName: string,
    accountNumber: string,
    options?: IReadRepoOptions
  ): Promise<IBankDetails | null>;

  findByLedgerAccountId(
    ledgerAccountId: TEntityId,
    options?: IReadRepoOptions
  ): Promise<IBankDetails | null>;

  update(
    ledgerAccountId: TEntityId,
    accountingEntityId: TEntityId,
    bankValue: IBankDetails,
    options: IWriteRepoOptions
  ): Promise<void>;

  create(
    ledgerAccountId: TEntityId,
    accountingEntityId: TEntityId,
    bankValue: IBankDetails,
    createdBy: TEntityId,
    options: IWriteRepoOptions
  ): Promise<void>;
}
