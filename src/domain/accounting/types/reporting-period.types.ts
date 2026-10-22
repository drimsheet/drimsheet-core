import { TEntityId } from '@shared/types/uuid';
import {
  IInterval,
  IPeriod,
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

export interface IReportingInterval extends Omit<IInterval, 'unit'> {
  unit: UReportingIntervalUnit;
  fiscalYearId: TEntityId;
  periods: IReportingPeriod[];
  createdBy: TEntityId;
  createdAt: Date;
  updatedAt: Date;
}
