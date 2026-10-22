import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IAccountingInterval } from '@domain/accounting/types/accounting-period.types';

export default interface IAccountingIntervalRepo {
  findById(
    accountingEntityId: TEntityId,
    id: TEntityId,
    options: IReadRepoOptions
  ): Promise<IAccountingInterval | null>;
}
