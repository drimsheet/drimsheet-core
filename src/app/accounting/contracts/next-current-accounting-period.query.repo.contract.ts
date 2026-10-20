import { IReadRepoOptions } from '@shared/types/repo.types';

import { INextCurrentAccountingPeriodDto } from '@app/accounting/dtos/current-accounting-period/current-accounting-period.dto';

export default interface INextCurrentAccountingPeriodQueryRepo {
  /** Returns unclosed contexts' next periods starting on or before the supplied UTC calendar date, across all accounting entities. */
  findDue(
    date: Date,
    options: IReadRepoOptions
  ): Promise<INextCurrentAccountingPeriodDto[]>;
}
