import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import {
  IEvent,
  TAuditedEntity,
} from '@shared/values/events/types/event.types';

import { IAccountingContextAudit } from './accounting-context-audit.types';
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

export interface ICurrentAccountingPeriodUpdateInput {
  accountingContextId: TEntityId;
  previousState: {
    currentAccountPeriod: TEntityId;
    nextAccountingPeriod: TEntityId;
  };
}

export default interface IAccountingContextService {
  /** Prepares the period transition, events and nullable audit; never persists. */
  updateCurrentAccountingPeriod(
    input: ICurrentAccountingPeriodUpdateInput,
    repoOptions: IReadRepoOptions
  ): Promise<
    [
      IAccountingContext,
      IEvent<IAccountingContext>[],
      IAccountingContextAudit | null,
    ]
  >;

  /**
   * Resolves previous/next periods from storage after enforcing ownership
   * and eligibility. Rejects lookup or validation failures; never persists.
   */
  create(
    input: ICreateAccountingContextInput,
    repoOptions: IReadRepoOptions
  ): Promise<
    TAuditedEntity<IAccountingContext, IAccountingContext, IAccountingContext>
  >;
}
