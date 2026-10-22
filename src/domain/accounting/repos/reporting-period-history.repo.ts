import { IWriteRepoOptions } from '@shared/types/repo.types';

import { IReportingPeriodHistory } from '@domain/accounting/types/reporting-period-audit.types';
import { IReportingPeriod } from '@domain/accounting/types/reporting-period.types';

export default interface IReportingPeriodHistoryRepo {
  save(
    periods: IReportingPeriod | IReportingPeriod[],
    histories: IReportingPeriodHistory | IReportingPeriodHistory[],
    options: IWriteRepoOptions
  ): Promise<void>;
}
