import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IReportingContext } from '@domain/accounting/types/context.types';
import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';
import { IReportingPeriod } from '@domain/accounting/types/period.types';

export interface IReportingContextDetails extends IReportingContext {
  fiscalYear: IFiscalYear;
  reportingPeriods: IReportingPeriod[];
}

export default interface IReportingContextQueryRepo {
  /** Returns unclosed contexts in creation order, with their fiscal year and all its periods in date order. */
  findActiveByAccountingEntityId(
    accountingEntityId: TEntityId,
    options: IReadRepoOptions
  ): Promise<IReportingContextDetails[]>;
}
