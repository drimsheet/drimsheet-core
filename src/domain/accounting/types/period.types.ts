import { TEntityId } from '@shared/types/uuid';
import { IHistory } from '@shared/values/history/types/history.types';

/**
 * ================== Reusable Period Types ==================
 */
export const EPeriodUnit = {
  Day: 'day',
  Week: 'week',
  Month: 'month',
  Quarter: 'quarter',
  Year: 'year',
} as const;

export type UPeriodUnit = (typeof EPeriodUnit)[keyof typeof EPeriodUnit];

export interface IPeriod {
  createdBy: TEntityId;
  id: TEntityId;
  name: string;
  accountingEntityId: TEntityId;
  unit: UPeriodUnit;
  count: number;
  startDate: Date;
  endDate: Date;
}

export const EPeriodHistoryAction = {
  Created: 'created',
  Opened: 'opened',
  Edited: 'edited',
  Closed: 'closed',
  Reopened: 'reopened',
} as const;

export type UPeriodHistoryAction =
  (typeof EPeriodHistoryAction)[keyof typeof EPeriodHistoryAction];

export interface IPeriodHistory<T extends IPeriod> extends IHistory<T> {}

export const EPeriodStatus = {
  Pending: 'pending',
  Open: 'open',
  Closing: 'closing',
  Closed: 'closed',
} as const;

export type UPeriodStatus = (typeof EPeriodStatus)[keyof typeof EPeriodStatus];

/**
 * ================== Accounting Period ==================
 */
export interface IAccountingPeriod extends IPeriod {
  status: UPeriodStatus;
  fiscalYearId: TEntityId;
  closedAt: Date | null;
  updatedAt: Date;
}

/**
 * startDate is the first included UTC calendar date; endDate is the last.
 * The interval is due for reporting from the following UTC day. Current-period
 * selection, scheduling, and report execution are handled separately.
 */
export interface IReportingPeriod extends IPeriod {
  fiscalYearId: TEntityId;
  updatedAt: Date;
}
