import {
  IEntityDelta,
  IHistory,
} from '@shared/values/history/types/history.types';

import { IReportingInterval, IReportingPeriod } from './reporting-period.types';

export const EReportingPeriodActions = {
  Created: 'created',
  Updated: 'updated',
} as const;

export type UReportingPeriodActions =
  (typeof EReportingPeriodActions)[keyof typeof EReportingPeriodActions];

export interface IReportingPeriodAudit extends IEntityDelta<IReportingPeriod> {
  action: UReportingPeriodActions;
}

export interface IMakeReportingPeriodAuditPayload {
  before: IReportingPeriod | null;
  after: IReportingPeriod;
  action: UReportingPeriodActions;
}

export interface IReportingPeriodHistory extends IHistory<IReportingPeriod> {}

export const EReportingIntervalActions = {
  Created: 'created',
  Updated: 'updated',
} as const;

export type UReportingIntervalActions =
  (typeof EReportingIntervalActions)[keyof typeof EReportingIntervalActions];

export interface IReportingIntervalAudit extends IEntityDelta<IReportingInterval> {
  action: UReportingIntervalActions;
}

export interface IMakeReportingIntervalAuditPayload {
  before: IReportingInterval | null;
  after: IReportingInterval;
  action: UReportingIntervalActions;
}

export interface IReportingIntervalHistory extends IHistory<IReportingInterval> {}
