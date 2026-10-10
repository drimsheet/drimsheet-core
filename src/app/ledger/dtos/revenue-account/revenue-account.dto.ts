import { ULedgerAccountCreationStatus } from '@domain/ledger/types/ledger.types';

type TSupportedRevenueAccountBehavior =
  | 'services'
  | 'employment_income'
  | 'gain_on_asset_sale'
  | 'unrealized_gains'
  | 'grants'
  | 'gifts';

export interface ICreateRevenueAccountDto {
  name: string;
  /** Defaults to active when omitted. */
  status?: ULedgerAccountCreationStatus;
  isControlAccount: boolean;
  /** @format uuid */
  controlAccountId?: string;
  behavior: TSupportedRevenueAccountBehavior;
}

/** Editable revenue account details; accounting identity is retained. */
export interface IUpdateRevenueAccountDto {
  name: string;
}
