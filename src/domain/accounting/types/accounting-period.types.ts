import { TEntityId } from '@shared/types/uuid';
import {
  IInterval,
  IPeriod,
} from '@shared/values/interval/types/interval.types';

export const EAccountingPeriodStatus = {
  Open: 'open',
  Closed: 'closed',
} as const;

export type UAccountingPeriodStatus =
  (typeof EAccountingPeriodStatus)[keyof typeof EAccountingPeriodStatus];

export const EAccountingIntervalUnit = {
  Day: 'day',
  Week: 'week',
  Month: 'month',
  Quarter: 'quarter',
  Year: 'year',
} as const;

export type UAccountingIntervalUnit =
  (typeof EAccountingIntervalUnit)[keyof typeof EAccountingIntervalUnit];

export interface IAccountingPeriod extends IPeriod {
  status: UAccountingPeriodStatus;
  createdBy: TEntityId;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAccountingInterval extends Omit<IInterval, 'unit'> {
  unit: UAccountingIntervalUnit;
  fiscalYearId: TEntityId;
  periods: IAccountingPeriod[];
  createdBy: TEntityId;
  createdAt: Date;
  updatedAt: Date;
}
