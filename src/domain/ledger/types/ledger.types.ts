import { TEntityId } from '@shared/types/uuid';
import { TAuditedEntity } from '@shared/values/events/types/event.types';

import { ICurrency } from '@domain/money/types/currency.types';

export const ELedgerType = {
  Asset: 'asset',
  Liability: 'liability',
  Revenue: 'revenue',
  Expense: 'expense',
  Equity: 'equity',
} as const;

export type ULedgerType = (typeof ELedgerType)[keyof typeof ELedgerType];

export const ENormalBalance = {
  Debit: 'debit',
  Credit: 'credit',
} as const;

export type UNormalBalance =
  (typeof ENormalBalance)[keyof typeof ENormalBalance];

export const ELedgerAccountStatus = {
  Active: 'active',
  Archived: 'archived',
} as const;

export type ULedgerAccountStatus =
  (typeof ELedgerAccountStatus)[keyof typeof ELedgerAccountStatus];

export const EContraAccountRule = {
  ContraPermitted: 'contra_permitted',
  ContraNotPermitted: 'contra_not_permitted',
  ContraOnly: 'contra_only',
  NotApplicable: 'contra_not_applicable',
} as const;

export type UContraAccountRule =
  (typeof EContraAccountRule)[keyof typeof EContraAccountRule];

export const EAdjunctAccountRule = {
  AdjunctPermitted: 'adjunct_permitted',
  AdjunctNotPermitted: 'adjunct_not_permitted',
  AdjunctOnly: 'adjunct_only',
  NotApplicable: 'adjunct_not_applicable',
} as const;

export type UAdjunctAccountRule =
  (typeof EAdjunctAccountRule)[keyof typeof EAdjunctAccountRule];

export const EAdjustmentType = {
  Contra: 'contra',
  Adjunct: 'adjunct',
} as const;

export type UAdjustmentType =
  (typeof EAdjustmentType)[keyof typeof EAdjustmentType];

/**
 * Metadata required for contra and adjunct accounts.
 * Every contra/adjunct account MUST carry this in its `meta` field,
 * specifying the target account it adjusts.
 *
 * @see ADR-0012: Relational Contra & Adjunct Accounts
 */
export interface IAdjustmentMetaData {
  adjustmentType: UAdjustmentType;
  targetAccountId: TEntityId;
}

export interface ILedgerAccount {
  id: TEntityId;
  code: string;
  materializedPath: string;
  accountingEntityId: TEntityId;
  type: ULedgerType;
  normalBalance: UNormalBalance;
  subType: string;
  behavior: string;
  isControlAccount: boolean;
  controlAccountId: TEntityId | null;
  name: string;
  currency: ICurrency | null;
  status: ULedgerAccountStatus;
  contraAccountRule: UContraAccountRule;
  adjunctAccountRule: UAdjunctAccountRule;
  meta: object | null;
  openingBalanceDate: Date | null;
  version: number;
  createdBy: TEntityId;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type TAuditedLedgerAccount = TAuditedEntity<
  ILedgerAccount,
  ILedgerAccount,
  ILedgerAccount
>;
