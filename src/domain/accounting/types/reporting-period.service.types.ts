import { IReadRepoOptions } from '@shared/types/repo.types';
import { TAuditedEntity } from '@shared/values/events/types/event.types';

import { IFiscalYear } from './fiscal-year.types';
import { IReportingPeriod } from './period.types';

interface IGeneratePayload extends Pick<
  IReportingPeriod,
  'createdBy' | 'accountingEntityId' | 'unit' | 'count'
> {
  fiscalYear: IFiscalYear;
}

export default interface IReportingPeriodService {
  /** Prepares inclusive UTC intervals. Rejects a fiscal year with any reporting periods; never persists.
   */
  generate(
    input: IGeneratePayload,
    options: IReadRepoOptions
  ): Promise<
    TAuditedEntity<IReportingPeriod, IReportingPeriod, IReportingPeriod>[]
  >;
}
