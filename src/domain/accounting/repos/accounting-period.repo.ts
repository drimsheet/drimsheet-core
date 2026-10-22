import { IReadRepoOptions, IWriteRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IAccountingPeriodHistory } from '@domain/accounting/types/accounting-period-audit.types';
import { IAccountingPeriod } from '@domain/accounting/types/accounting-period.types';

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
  findByRange(
    accountingEntityId: TEntityId,
    range: Pick<IAccountingPeriod, 'startDate' | 'endDate'>,
    options: IReadRepoOptions
  ): Promise<IAccountingPeriod[]>;

  create(
    periods: IAccountingPeriod[],
    options: IWriteRepoOptions<IAccountingPeriodHistory[]>
  ): Promise<void>;
}
