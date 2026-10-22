import { TEntityId } from '@shared/types/uuid';
import {
  IInterval,
  IPeriod,
  IPeriodMakePayload,
} from '@shared/values/interval/types/interval.types';

export const EReportingIntervalUnit = {
  Day: 'day',
  Week: 'week',
  Month: 'month',
  Quarter: 'quarter',
  Year: 'year',
} as const;

export type UReportingIntervalUnit =
  (typeof EReportingIntervalUnit)[keyof typeof EReportingIntervalUnit];

export interface IReportingPeriod extends IPeriod {
  createdBy: TEntityId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IReportingPeriodMakePayload extends Omit<
  IPeriod,
  'intervalId' | 'accountingEntityId'
> {}

export interface IReportingInterval extends Omit<IInterval, 'unit'> {
  unit: UReportingIntervalUnit;
  fiscalYearId: TEntityId;
  periods: IReportingPeriod[];
  createdBy: TEntityId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IReportingIntervalMakePayload extends Pick<
  IReportingInterval,
  | 'accountingEntityId'
  | 'fiscalYearId'
  | 'unit'
  | 'count'
  | 'startDate'
  | 'endDate'
  | 'createdBy'
> {
  periods: IPeriodMakePayload[];
}
