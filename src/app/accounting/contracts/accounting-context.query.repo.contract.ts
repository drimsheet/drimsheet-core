import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IAccountingContext } from '@domain/accounting/types/context.types';
import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';
import { IAccountingPeriod } from '@domain/accounting/types/period.types';

export interface IAccountingContextDetails extends IAccountingContext {
  fiscalYear: IFiscalYear;
  accountingPeriods: IAccountingPeriod[];
}

export default interface IAccountingContextQueryRepo {
  /** Returns unclosed contexts in creation order, with their fiscal year and all its periods in date order. */
  findActiveByAccountingEntityId(
    accountingEntityId: TEntityId,
    options: IReadRepoOptions
  ): Promise<IAccountingContextDetails[]>;
}
