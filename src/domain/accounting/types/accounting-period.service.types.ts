import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import { TAuditedEntity } from '@shared/values/events/types/event.types';

import { IFiscalYear } from './fiscal-year.types';
import { IAccountingPeriod } from './period.types';

interface IGeneratePayload extends Pick<
  IAccountingPeriod,
  'createdBy' | 'accountingEntityId' | 'unit' | 'count'
> {
  fiscalYear: IFiscalYear;
}

export default interface IAccountingPeriodService {
  /** Generates the fiscal year's periods; rejects overlap with stored periods. Does not persist. */
  generate(
    input: IGeneratePayload,
    repoOptions: IReadRepoOptions
  ): Promise<
    TAuditedEntity<IAccountingPeriod, IAccountingPeriod, IAccountingPeriod>[]
  >;

  /** Requires exactly one covering Open period; rejects missing, ambiguous or non-Open periods. */
  validatePostingPeriod(
    accountingEntityId: TEntityId,
    postingDate: Date,
    repoOptions: IReadRepoOptions
  ): Promise<IAccountingPeriod>;
}
