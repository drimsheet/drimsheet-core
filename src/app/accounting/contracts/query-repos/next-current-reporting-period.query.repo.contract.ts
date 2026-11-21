import { IReadRepoOptions } from '@shared/types/repo.types';

import { INextCurrentReportingPeriodDto } from '@app/accounting/dtos/current-reporting-period/current-reporting-period.dto';

export default interface INextCurrentReportingPeriodQueryRepo {
  /**
   * Returns intervals whose next period starts before the supplied instant,
   * across all accounting entities.
   */
  findDue(
    date: Date,
    options: IReadRepoOptions
  ): Promise<INextCurrentReportingPeriodDto[]>;
}
