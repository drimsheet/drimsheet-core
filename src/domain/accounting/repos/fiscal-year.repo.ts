import { IReadRepoOptions, IWriteRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';
import { IFiscalYearHistory } from '@domain/accounting/types/period-audit.types';

export default interface IFiscalYearRepo {
  findByAccountingEntityId(
    accountingEntityId: TEntityId,
    options: IReadRepoOptions
  ): Promise<IFiscalYear[]>;

  findById(
    accountingEntityId: TEntityId,
    id: TEntityId,
    options: IReadRepoOptions
  ): Promise<IFiscalYear | null>;

  /** Inclusive calendar-date overlap, across all statuses for this entity. */
  existsByRange(
    accountingEntityId: TEntityId,
    range: Pick<IFiscalYear, 'startDate' | 'endDate'>,
    options: IReadRepoOptions
  ): Promise<boolean>;

  create(
    payload: IFiscalYear,
    options: IWriteRepoOptions<IFiscalYearHistory>
  ): Promise<void>;
}
