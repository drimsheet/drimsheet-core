import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import { IEvent } from '@shared/values/events/types/event.types';

import { IAccountingEntity } from './accounting-entity.types';
import { IAccountingContext, IReportingContext } from './context.types';
import {
  IReportingContextAudit,
  TAuditedReportingContext,
} from './reporting-context-audit.types';
import { IReportingInterval } from './reporting-period.types';

interface ICreateReportingContextInput extends Pick<
  IReportingContext,
  'createdBy' | 'name' | 'description' | 'reportingCurrencyCode'
> {
  accountingEntity: IAccountingEntity;
  accountingContext: IAccountingContext;
  reportingInterval: IReportingInterval;
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
   * Rejects archived entities and invalid interval or context ownership,
   * or currency. Rejects existing reporting contexts, including closed ones
   * (ACC-RC-006), before preparing the context, event, and audit. Never persists.
   */
  create(
    input: ICreateReportingContextInput,
    repoOptions: IReadRepoOptions
  ): Promise<TAuditedReportingContext>;
}
