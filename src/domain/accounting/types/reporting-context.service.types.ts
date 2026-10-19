import { TAuditedEntity } from '@shared/values/events/types/event.types';

import { IAccountingEntity } from './accounting-entity.types';
import { IAccountingContext, IReportingContext } from './context.types';
import { IReportingPeriod } from './period.types';

interface ICreateReportingContextInput extends Pick<
  IReportingContext,
  | 'createdBy'
  | 'name'
  | 'description'
  | 'accountingStandardCode'
  | 'reportingCurrencyCode'
> {
  accountingEntity: IAccountingEntity;
  accountingContext: IAccountingContext;
  reportingPeriod: IReportingPeriod;
}

export default interface IReportingContextService {
  /**
   * Rejects archived entities and invalid reference ownership, framework,
   * or currency before preparing the context, event, and audit. Never persists.
   */
  create(
    input: ICreateReportingContextInput
  ): TAuditedEntity<IReportingContext, IReportingContext, IReportingContext>;
}
