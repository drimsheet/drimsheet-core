import {
  ILedgerAccountPromotionNames,
  ULedgerAccountCreationStatus,
} from '@domain/ledger/types/ledger.types';

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
  /** Applied only during promotion; omitted names retain the original account name. */
  promotionNames?: ILedgerAccountPromotionNames;
  behavior: TSupportedRevenueAccountBehavior;
}

/** Editable revenue account details; accounting identity is retained. */
export interface IUpdateRevenueAccountDto {
  name: string;
}
