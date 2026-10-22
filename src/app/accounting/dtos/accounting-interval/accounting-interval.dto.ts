import { IAccountingIntervalMakePayload } from '@domain/accounting/types/accounting-period.types';

export interface IAccountingIntervalCreationReq extends Pick<
  IAccountingIntervalMakePayload,
  'unit' | 'count' | 'periods'
> {
  fiscalYearId: string;
}
