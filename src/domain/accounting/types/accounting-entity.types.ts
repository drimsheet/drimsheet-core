import { TEntityId } from '@shared/types/uuid';
import { IHistory } from '@shared/values/history/types/history.types';

import { UJurisdictionCode } from '@domain/accounting/config/jurisdictions.config';
import { UCurrencyCode } from '@domain/money/config/currencies.config';

export const EAccountingEntityType = {
  Individual: 'individual',
  SoleTrader: 'sole_trader',
  PrivateCompany: 'private_company',
} as const;

export type UAccountingEntityType =
  (typeof EAccountingEntityType)[keyof typeof EAccountingEntityType];

export const EAccountingEntityStatus = {
  Active: 'active',
  Archived: 'archived',
} as const;

export type UAccountingEntityStatus =
  (typeof EAccountingEntityStatus)[keyof typeof EAccountingEntityStatus];

export interface IAccountingEntity {
  createdBy: TEntityId;
  id: TEntityId;
  name: string;
  status: UAccountingEntityStatus;
  type: UAccountingEntityType;
  ownerId: TEntityId;
  functionalCurrencyCode: UCurrencyCode;
  jurisdictionCode: UJurisdictionCode;
  createdAt: Date;
  updatedAt: Date;
}

export const EAccountingEntityHistoryAction = {
  Created: 'created',
  Updated: 'updated',
  Archived: 'archived',
} as const;

export type UAccountingEntityHistoryAction =
  (typeof EAccountingEntityHistoryAction)[keyof typeof EAccountingEntityHistoryAction];

export type IAccountingEntityHistory = IHistory<IAccountingEntity>;
