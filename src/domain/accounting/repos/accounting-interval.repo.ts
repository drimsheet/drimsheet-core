import { IReadRepoOptions, IWriteRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IAccountingIntervalHistory } from '@domain/accounting/types/accounting-period-audit.types';
import { IAccountingInterval } from '@domain/accounting/types/accounting-period.types';

export default interface IAccountingIntervalRepo {
  create(
    interval: Omit<IAccountingInterval, 'periods'>,
    options: IWriteRepoOptions<IAccountingIntervalHistory>
  ): Promise<void>;

  /** Saves the interval header and history atomically; leaves children intact. */
  update(
    interval: Omit<IAccountingInterval, 'periods'>,
    options: IWriteRepoOptions<IAccountingIntervalHistory>
  ): Promise<void>;

  /** Whether this entity already has an interval for the fiscal year. */
  existsByFiscalYear(
    accountingEntityId: TEntityId,
    fiscalYearId: TEntityId,
    options: IReadRepoOptions
  ): Promise<boolean>;

  findById(
    accountingEntityId: TEntityId,
    id: TEntityId,
    options: IReadRepoOptions
  ): Promise<IAccountingInterval | null>;
}
