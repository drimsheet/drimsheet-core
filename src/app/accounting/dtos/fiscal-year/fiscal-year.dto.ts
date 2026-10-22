import { UFiscalYearStatus } from '@domain/accounting/types/fiscal-year.types';

export interface IFiscalYearCreationReq {
  accountingEntityId: string;
  name?: string;
  startDate: Date;
  endDate: Date;
  status: UFiscalYearStatus;
}
