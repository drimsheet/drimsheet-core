import { IReadRepoOptions } from '@shared/types/repo.types';

import { INextCurrentAccountingPeriodDto } from '@app/accounting/dtos/current-accounting-period/current-accounting-period.dto';

export default interface INextCurrentAccountingPeriodQueryRepo {
  /**
   * Returns intervals whose next period starts before the supplied instant,
   * across all accounting entities.
   */
  findDue(
    date: Date,
    options: IReadRepoOptions
  ): Promise<INextCurrentAccountingPeriodDto[]>;
}
