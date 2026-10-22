import { IReadRepoOptions, IWriteRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IReportingIntervalHistory } from '@domain/accounting/types/reporting-period-audit.types';
import { IReportingInterval } from '@domain/accounting/types/reporting-period.types';

export default interface IReportingIntervalRepo {
  create(
    interval: Omit<IReportingInterval, 'periods'>,
    options: IWriteRepoOptions<IReportingIntervalHistory>
  ): Promise<void>;

  findById(
    accountingEntityId: TEntityId,
    id: TEntityId,
    options: IReadRepoOptions
  ): Promise<IReportingInterval | null>;
}
