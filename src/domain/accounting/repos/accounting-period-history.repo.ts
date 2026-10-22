import { IWriteRepoOptions } from '@shared/types/repo.types';

import { IAccountingPeriodHistory } from '@domain/accounting/types/accounting-period-audit.types';
import { IAccountingPeriod } from '@domain/accounting/types/accounting-period.types';

export default interface IAccountingPeriodHistoryRepo {
  save(
    periods: IAccountingPeriod | IAccountingPeriod[],
    histories: IAccountingPeriodHistory | IAccountingPeriodHistory[],
    options: IWriteRepoOptions
  ): Promise<void>;
}
