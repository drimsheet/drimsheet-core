import { IReportingIntervalMakePayload } from '@domain/accounting/types/reporting-period.types';

export interface IReportingIntervalCreationReq extends Pick<
  IReportingIntervalMakePayload,
  'unit' | 'count' | 'periods'
> {
  fiscalYearId: string;
}
