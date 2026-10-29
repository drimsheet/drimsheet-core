import { IReadRepoOptions, IWriteRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IFiscalYearHistory } from '@domain/accounting/types/fiscal-year-audit.types';
import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';

export default interface IFiscalYearRepo {
  findByAccountingEntityId(
    accountingEntityId: TEntityId,
    options: IReadRepoOptions
  ): Promise<IFiscalYear[]>;

  /** Inclusive UTC date lookup across statuses, ordered by start date then ID. */
  findByDate(
    accountingEntityId: TEntityId,
    date: Date,
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
