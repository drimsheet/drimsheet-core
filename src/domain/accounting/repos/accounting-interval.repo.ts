import { IReadRepoOptions, IWriteRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IAccountingIntervalHistory } from '@domain/accounting/types/accounting-period-audit.types';
import { IAccountingInterval } from '@domain/accounting/types/accounting-period.types';

export default interface IAccountingIntervalRepo {
  create(
    interval: Omit<IAccountingInterval, 'periods'>,
    options: IWriteRepoOptions<IAccountingIntervalHistory>
  ): Promise<void>;

  /** Half-open instant overlap across all intervals belonging to the entity. */
  existsByRange(
    accountingEntityId: TEntityId,
    range: Pick<IAccountingInterval, 'startDate' | 'endDate'>,
    options: IReadRepoOptions
  ): Promise<boolean>;

  findById(
    accountingEntityId: TEntityId,
    id: TEntityId,
    options: IReadRepoOptions
  ): Promise<IAccountingInterval | null>;
}
