import { IEvent } from '@shared/values/events/types/event.types';
import {
  IEntityDelta,
  IHistory,
} from '@shared/values/history/types/history.types';

import { IAccountingContext } from './context.types';

export const EAccountingContextActions = {
  Created: 'created',
  Updated: 'updated',
} as const;

export type UAccountingContextActions =
  (typeof EAccountingContextActions)[keyof typeof EAccountingContextActions];

export interface IAccountingContextAudit extends IEntityDelta<IAccountingContext> {
  action: UAccountingContextActions;
}

export interface IMakeAccountingContextAuditPayload {
  before: IAccountingContext | null;
  after: IAccountingContext;
  action: UAccountingContextActions;
}

export interface IAccountingContextHistory extends IHistory<IAccountingContext> {}

export type TAuditedAccountingContext = [
  IAccountingContext,
  IEvent<IAccountingContext>[],
  IAccountingContextAudit,
];

export type TAuditedAccountingContextUpdate = [
  IAccountingContext,
  IEvent<IAccountingContext>[],
  IAccountingContextAudit | null,
];
