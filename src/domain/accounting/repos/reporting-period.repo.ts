import { IReadRepoOptions, IWriteRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IReportingPeriodHistory } from '@domain/accounting/types/reporting-period-audit.types';
import { IReportingPeriod } from '@domain/accounting/types/reporting-period.types';

export default interface IReportingPeriodRepo {
  findById(
    // TODO: include accounting entity id
    id: TEntityId,
    options: IReadRepoOptions
  ): Promise<IReportingPeriod | null>;

  findAllByFiscalYear(
    accountingEntityId: TEntityId,
    fiscalYearId: TEntityId,
    options: IReadRepoOptions
  ): Promise<IReportingPeriod[]>;

  create(
    periods: IReportingPeriod[],
    options: IWriteRepoOptions<IReportingPeriodHistory[]>
  ): Promise<void>;
}
