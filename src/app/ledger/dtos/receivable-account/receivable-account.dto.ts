import {
  ILedgerAccountPromotionNames,
  ULedgerAccountCreationStatus,
} from '@domain/ledger/types/ledger.types';

export interface ICreateTradeReceivableAccountDto {
  name: string;
  /** Defaults to active when omitted. */
  status?: ULedgerAccountCreationStatus;
  isControlAccount: boolean;
  /** @format uuid */
  controlAccountId?: string;
  /** Applied only during promotion; omitted names retain the original account name. */
  promotionNames?: ILedgerAccountPromotionNames;
  currencyCode: string;
}

export interface ICreateStatutoryReceivableAccountDto {
  name: string;
  /** Defaults to active when omitted. */
  status?: ULedgerAccountCreationStatus;
  isControlAccount: boolean;
  /** @format uuid */
  controlAccountId?: string;
  /** Applied only during promotion; omitted names retain the original account name. */
  promotionNames?: ILedgerAccountPromotionNames;
  currencyCode: string;
}
