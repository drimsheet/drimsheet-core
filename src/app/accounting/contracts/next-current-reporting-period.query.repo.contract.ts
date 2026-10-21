import { IReadRepoOptions } from '@shared/types/repo.types';

import { INextCurrentReportingPeriodDto } from '@app/accounting/dtos/current-reporting-period/current-reporting-period.dto';

export default interface INextCurrentReportingPeriodQueryRepo {
  /**
   * Returns unclosed contexts' next periods due by the supplied UTC date,
   * across all accounting entities.
   */
  findDue(
    date: Date,
    options: IReadRepoOptions
  ): Promise<INextCurrentReportingPeriodDto[]>;
}
