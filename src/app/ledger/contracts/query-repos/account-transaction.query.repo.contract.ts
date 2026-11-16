import { IPaginatedReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import { IPaginatedResponse } from '@shared/values/pagination/types/pagination.types';

import { IAccountTransaction } from '@domain/journal-entry/types/account-transaction.types';

export default interface IAccountTransactionQueryRepo {
  findAllByAccountId(
    accountId: TEntityId,
    options: IPaginatedReadRepoOptions
  ): Promise<IPaginatedResponse<IAccountTransaction>>;
}
