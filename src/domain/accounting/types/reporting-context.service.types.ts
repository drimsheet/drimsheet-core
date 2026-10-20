import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import {
  IEvent,
  TAuditedEntity,
} from '@shared/values/events/types/event.types';

import { IAccountingEntity } from './accounting-entity.types';
import { IAccountingContext, IReportingContext } from './context.types';
import { IReportingPeriod } from './period.types';
import { IReportingContextAudit } from './reporting-context-audit.types';

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
  /** Prepares the period transition, events and nullable audit; never persists. */
  updateCurrentReportingPeriod(
    input: {
      reportingContextId: TEntityId;
      previousState: {
        currentReportingPeriod: TEntityId;
        nextReportingPeriod: TEntityId;
      };
    },
    repoOptions: IReadRepoOptions
  ): Promise<
    [
      IReportingContext,
      IEvent<IReportingContext>[],
      IReportingContextAudit | null,
    ]
  >;

  /**
   * Rejects archived entities and invalid reference ownership, framework,
   * or currency before preparing the context, event, and audit. Never persists.
   */
  create(
    input: ICreateReportingContextInput
  ): TAuditedEntity<IReportingContext, IReportingContext, IReportingContext>;
}
