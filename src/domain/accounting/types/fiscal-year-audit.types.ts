import {
  IEntityDelta,
  IHistory,
} from '@shared/values/history/types/history.types';

import { IFiscalYear } from './fiscal-year.types';

export const EFiscalYearActions = {
  Created: 'created',
  Opened: 'opened',
  Edited: 'edited',
  Closed: 'closed',
  Reopened: 'reopened',
} as const;

export type UFiscalYearActions =
  (typeof EFiscalYearActions)[keyof typeof EFiscalYearActions];

export interface IFiscalYearAudit extends IEntityDelta<IFiscalYear> {
  action: UFiscalYearActions;
}

export interface IMakeFiscalYearAuditPayload {
  before: IFiscalYear | null;
  after: IFiscalYear;
  action: UFiscalYearActions;
}

export type IFiscalYearHistory = IHistory<IFiscalYear>;
