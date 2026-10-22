import { IEvent } from '@shared/values/events/types/event.types';
import {
  IEntityDelta,
  IHistory,
} from '@shared/values/history/types/history.types';

import {
  IAccountingInterval,
  IAccountingPeriod,
} from './accounting-period.types';

export const EAccountingPeriodActions = {
  Created: 'created',
  Updated: 'updated',
  Closed: 'closed',
  Reopened: 'reopened',
} as const;

export type UAccountingPeriodActions =
  (typeof EAccountingPeriodActions)[keyof typeof EAccountingPeriodActions];

export interface IAccountingPeriodAudit extends IEntityDelta<IAccountingPeriod> {
  action: UAccountingPeriodActions;
}

export interface IMakeAccountingPeriodAuditPayload {
  before: IAccountingPeriod | null;
  after: IAccountingPeriod;
  action: UAccountingPeriodActions;
}

export interface IAccountingPeriodHistory extends IHistory<IAccountingPeriod> {}

export type TAuditedAccountingPeriod = [
  IAccountingPeriod,
  IEvent<IAccountingPeriod>[],
  IAccountingPeriodAudit,
];

export const EAccountingIntervalActions = {
  Created: 'created',
  Updated: 'updated',
} as const;

export type UAccountingIntervalActions =
  (typeof EAccountingIntervalActions)[keyof typeof EAccountingIntervalActions];

export interface IAccountingIntervalAudit extends IEntityDelta<IAccountingInterval> {
  action: UAccountingIntervalActions;
}

export interface IMakeAccountingIntervalAuditPayload {
  before: IAccountingInterval | null;
  after: IAccountingInterval;
  action: UAccountingIntervalActions;
}

export interface IAccountingIntervalHistory extends IHistory<IAccountingInterval> {}

export type TAuditedAccountingInterval = [
  IAccountingInterval,
  IEvent<IAccountingInterval | IAccountingPeriod>[],
  {
    interval: IAccountingIntervalAudit;
    periods: IAccountingPeriodAudit[];
  },
];
