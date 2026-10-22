import { IEvent } from '@shared/values/events/types/event.types';
import {
  IEntityDelta,
  IHistory,
} from '@shared/values/history/types/history.types';

import { IReportingContext } from './context.types';

export const EReportingContextActions = {
  Created: 'created',
  Updated: 'updated',
} as const;

export type UReportingContextActions =
  (typeof EReportingContextActions)[keyof typeof EReportingContextActions];

export interface IReportingContextAudit extends IEntityDelta<IReportingContext> {
  action: UReportingContextActions;
}

export interface IMakeReportingContextAuditPayload {
  before: IReportingContext | null;
  after: IReportingContext;
  action: UReportingContextActions;
}

export interface IReportingContextHistory extends IHistory<IReportingContext> {}

export type TAuditedReportingContext = [
  IReportingContext,
  IEvent<IReportingContext>[],
  IReportingContextAudit,
];

export type TAuditedReportingContextUpdate = [
  IReportingContext,
  IEvent<IReportingContext>[],
  IReportingContextAudit | null,
];
