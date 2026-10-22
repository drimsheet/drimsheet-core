import { IReadRepoOptions } from '@shared/types/repo.types';

import { TAuditedAccountingInterval } from './accounting-period-audit.types';
import { IAccountingIntervalMakePayload } from './accounting-period.types';
import { IFiscalYear } from './fiscal-year.types';

interface ICreateAccountingIntervalInput extends Pick<
  IAccountingIntervalMakePayload,
  'accountingEntityId' | 'createdBy' | 'unit' | 'count' | 'periods'
> {
  fiscalYear: IFiscalYear;
}

export default interface IAccountingIntervalService {
  /**
   * Prepares the full fiscal-year interval, child periods, events, and audits.
   * Validates fiscal-year ownership and rejects overlapping stored periods.
   * Converts the inclusive fiscal-year end to an exclusive interval end.
   * Never persists.
   */
  create(
    input: ICreateAccountingIntervalInput,
    options: IReadRepoOptions
  ): Promise<TAuditedAccountingInterval>;
}
