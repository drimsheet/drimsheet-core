import { UCurrencyCode } from '@domain/money/config/currencies.config';

export interface IReportingContextCreationReq {
  accountingContextId: string;
  reportingIntervalId: string;
  reportingCurrencyCode: UCurrencyCode;
  name: string;
  description: string | null;
}
