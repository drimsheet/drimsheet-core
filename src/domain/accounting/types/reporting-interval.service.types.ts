import { IReadRepoOptions } from '@shared/types/repo.types';

import { IFiscalYear } from './fiscal-year.types';
import { TAuditedReportingInterval } from './reporting-period-audit.types';
import { IReportingIntervalMakePayload } from './reporting-period.types';

interface ICreateReportingIntervalInput extends Pick<
  IReportingIntervalMakePayload,
  'accountingEntityId' | 'createdBy' | 'unit' | 'count' | 'periods'
> {
  fiscalYear: IFiscalYear;
}

export default interface IReportingIntervalService {
  /**
   * Prepares the full fiscal-year interval, child periods, events, and audits.
   * Validates fiscal-year ownership and uniqueness.
   * Converts the inclusive fiscal-year end to an exclusive interval end.
   * Never persists.
   */
  create(
    input: ICreateReportingIntervalInput,
    options: IReadRepoOptions
  ): Promise<TAuditedReportingInterval>;
}
