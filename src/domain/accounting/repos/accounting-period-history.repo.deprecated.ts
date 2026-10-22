import { IWriteRepoOptions } from '@shared/types/repo.types';

import { IAccountingPeriodHistory } from '@domain/accounting/types/period-audit.types';
import { IAccountingPeriod } from '@domain/accounting/types/period.types';

export default interface IAccountingPeriodHistoryRepo {
  save(
    periods: IAccountingPeriod | IAccountingPeriod[],
    histories: IAccountingPeriodHistory | IAccountingPeriodHistory[],
    options: IWriteRepoOptions
  ): Promise<void>;
}
