import {
  IEntityDelta,
  IHistory,
} from '@shared/values/history/types/history.types';

import { ICounterparty } from './counterparty.types';

export const ECounterpartyEntityActions = {
  Created: 'created',
  Updated: 'updated',
  Activated: 'activated',
  RoleAdded: 'role-added',
} as const;

export type UCounterpartyEntityActions =
  (typeof ECounterpartyEntityActions)[keyof typeof ECounterpartyEntityActions];

export interface ICounterpartyAudit extends IEntityDelta<ICounterparty> {
  action: UCounterpartyEntityActions;
}

export interface IMakeCounterpartyAuditPayload {
  before: ICounterparty | null;
  after: ICounterparty;
  action: UCounterpartyEntityActions;
}

export interface ICounterpartyHistory extends IHistory<ICounterparty> {}
