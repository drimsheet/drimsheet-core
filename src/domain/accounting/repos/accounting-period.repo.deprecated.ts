import { IReadRepoOptions, IWriteRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IAccountingPeriodHistory } from '@domain/accounting/types/period-audit.types';
import { IAccountingPeriod } from '@domain/accounting/types/period.types';

export default interface IAccountingPeriodRepo {
  findAllByFiscalYear(
    accountingEntityId: TEntityId,
    fiscalYearId: TEntityId,
    options: IReadRepoOptions
  ): Promise<IAccountingPeriod[]>;

  findById(
    accountingEntityId: TEntityId,
    id: TEntityId,
    options: IReadRepoOptions
  ): Promise<IAccountingPeriod | null>;

  findByDate(
    accountingEntityId: TEntityId,
    date: Date,
    options: IReadRepoOptions
  ): Promise<IAccountingPeriod | null>;

  findAllByDate(
    accountingEntityId: TEntityId,
    date: Date,
    options: IReadRepoOptions
  ): Promise<IAccountingPeriod[]>;

  /** Returns periods for this entity that intersect the inclusive date range. */
  findByRange(
    accountingEntityId: TEntityId,
    range: Pick<IAccountingPeriod, 'startDate' | 'endDate'>,
    options: IReadRepoOptions
  ): Promise<IAccountingPeriod[]>;

  create(
    payload: IAccountingPeriod | IAccountingPeriod[],
    options: IWriteRepoOptions<
      IAccountingPeriodHistory | IAccountingPeriodHistory[]
    >
  ): Promise<void>;
}
