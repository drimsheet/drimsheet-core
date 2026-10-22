import { IReadRepoOptions } from '@shared/types/repo.types';

import { TAuditedAccountingContext } from './accounting-context-audit.types';
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

export default interface IAccountingContextService {
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
