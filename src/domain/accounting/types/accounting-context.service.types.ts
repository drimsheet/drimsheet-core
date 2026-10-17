import { TAuditedEntity } from '@shared/values/events/types/event.types';

import { IAccountingEntity } from './accounting-entity.types';
import { IAccountingContext } from './context.types';
import { IFiscalYear } from './fiscal-year.types';
import { IAccountingPeriod } from './period.types';

interface ICreateAccountingContextInput extends Pick<
  IAccountingContext,
  'createdBy' | 'name' | 'description' | 'accountingStandardCode'
> {
  accountingEntity: IAccountingEntity;
  fiscalYear: IFiscalYear;
  accountingPeriod: IAccountingPeriod;
}

export default interface IAccountingContextService {
  /** Rejects archived entities and enforces reference ownership and framework eligibility before preparing the context, event, and audit. Never persists. */
  create(
    input: ICreateAccountingContextInput
  ): TAuditedEntity<IAccountingContext, IAccountingContext, IAccountingContext>;
}
