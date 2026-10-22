import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IReportingInterval } from '@domain/accounting/types/reporting-period.types';

export default interface IReportingIntervalRepo {
  findById(
    accountingEntityId: TEntityId,
    id: TEntityId,
    options: IReadRepoOptions
  ): Promise<IReportingInterval | null>;
}
