import { IReadRepoOptions } from '@shared/types/repo.types';
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
