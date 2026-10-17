import { IReadRepoOptions, IWriteRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IReportingPeriodHistory } from '@domain/accounting/types/period-audit.types';
import { IReportingPeriod } from '@domain/accounting/types/period.types';

export default interface IReportingPeriodRepo {
  findAllByFiscalYear(
    accountingEntityId: TEntityId,
    fiscalYearId: TEntityId,
    options: IReadRepoOptions
  ): Promise<IReportingPeriod[]>;

  create(
    payload: IReportingPeriod | IReportingPeriod[],
    options: IWriteRepoOptions<
      IReportingPeriodHistory | IReportingPeriodHistory[]
    >
  ): Promise<void>;
}
