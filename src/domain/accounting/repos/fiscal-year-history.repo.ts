import { IWriteRepoOptions } from '@shared/types/repo.types';

import { IFiscalYearHistory } from '@domain/accounting/types/fiscal-year-audit.types';
import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';

export default interface IFiscalYearHistoryRepo {
  save(
    fiscalYear: IFiscalYear,
    history: IFiscalYearHistory,
    options: IWriteRepoOptions
  ): Promise<void>;
}
