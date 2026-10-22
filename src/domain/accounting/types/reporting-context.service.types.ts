import { IReadRepoOptions } from '@shared/types/repo.types';

import { IAccountingEntity } from './accounting-entity.types';
import { IAccountingContext, IReportingContext } from './context.types';
import { TAuditedReportingContext } from './reporting-context-audit.types';
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
