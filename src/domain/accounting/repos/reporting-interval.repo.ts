import { IReadRepoOptions, IWriteRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IReportingIntervalHistory } from '@domain/accounting/types/reporting-period-audit.types';
import { IReportingInterval } from '@domain/accounting/types/reporting-period.types';

export default interface IReportingIntervalRepo {
  create(
    interval: Omit<IReportingInterval, 'periods'>,
    options: IWriteRepoOptions<IReportingIntervalHistory>
  ): Promise<void>;

  /** Saves the interval header and history atomically; leaves children intact. */
  update(
    interval: Omit<IReportingInterval, 'periods'>,
    options: IWriteRepoOptions<IReportingIntervalHistory>
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
  ): Promise<IReportingInterval | null>;

  findByFiscalYear(
    accountingEntityId: TEntityId,
    fiscalYearId: TEntityId,
    options: IReadRepoOptions
  ): Promise<IReportingInterval | null>;
}
