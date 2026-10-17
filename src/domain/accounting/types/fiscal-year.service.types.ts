import { IReadRepoOptions } from '@shared/types/repo.types';
import { TAuditedEntity } from '@shared/values/events/types/event.types';

import { IAccountingEntity } from './accounting-entity.types';
import { IFiscalYear } from './fiscal-year.types';

interface ICreateFiscalYearInput extends Pick<
  IFiscalYear,
  'createdBy' | 'startDate' | 'endDate' | 'status'
> {
  accountingEntity: IAccountingEntity;
  name?: string;
}

export default interface IFiscalYearService {
  /** Prepares a valid, non-overlapping year and its event/audit without persisting. */
  create(
    input: ICreateFiscalYearInput,
    options: IReadRepoOptions
  ): Promise<TAuditedEntity<IFiscalYear, IFiscalYear, IFiscalYear>>;
}
