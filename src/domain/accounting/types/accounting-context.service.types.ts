import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import { IEvent } from '@shared/values/events/types/event.types';

import {
  IAccountingContextAudit,
  TAuditedAccountingContext,
} from './accounting-context-audit.types';
import { IAccountingEntity } from './accounting-entity.types';
import { IAccountingInterval } from './accounting-period.types';
import { IAccountingContext } from './context.types';
import { IFiscalYear } from './fiscal-year.types';

interface ICreateAccountingContextInput extends Pick<
  IAccountingContext,
  'createdBy' | 'name' | 'description' | 'accountingStandardCode'
> {
  accountingEntity: IAccountingEntity;
  fiscalYear: IFiscalYear;
  accountingInterval: IAccountingInterval;
}

interface ICurrentAccountingPeriodUpdateInput {
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
   * Prepares a context referencing the selected interval after enforcing
   * ownership and eligibility. Rejects an existing context for the fiscal year,
   * including a closed context (ACC-AC-005), or lookup/validation failures;
   * never persists.
   */
  create(
    input: ICreateAccountingContextInput,
    repoOptions: IReadRepoOptions
  ): Promise<TAuditedAccountingContext>;
}
