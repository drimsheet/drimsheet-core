import {
  ILedgerAccountPromotionNames,
  ULedgerAccountCreationStatus,
} from '@domain/ledger/types/ledger.types';

import { IOpeningBalanceDto } from '@app/journal-entry/dtos/opening-balance/opening-balance.dto';

export interface ICashAccountActivationDto {
  /** Posts the associated draft opening balance atomically with account activation when true. */
  activateOpeningBalance: boolean;
}

export interface IPettyCashAccountCreationReq {
  name: string;
  /** Defaults to active when omitted. */
  status?: ULedgerAccountCreationStatus;
  currencyCode: string;
  isControlAccount: boolean;
  controlAccountId?: string;
  /** Applied only during promotion; omitted names retain the original account name. */
  promotionNames?: ILedgerAccountPromotionNames;
  openingBalance: IOpeningBalanceDto | null;
}

export interface IPettyCashAccountUpdateReq {
  currencyCode?: string;
  name?: string;
  openingBalance?: IOpeningBalanceDto;
}

/** Editable bank ledger and bank details; currency changes require no journal references. */
export interface IBankAccountUpdateReq {
  currencyCode?: string;
  /** Replaces bank details when supplied; omitted details are retained. */
  bankAccount?: IBankDetailsCreationReq;
  name?: string;
  openingBalance?: IOpeningBalanceDto;
}

export interface IBankDetailsCreationReq {
  bankName: string;
  accountName: string;
  accountNumber: string;
}

export interface IBankAccountCreationReq {
  name: string;
  /** Defaults to active when omitted. */
  status?: ULedgerAccountCreationStatus;
  currencyCode: string;
  controlAccountId?: string;
  /** Applied only during promotion; omitted names retain the original account name. */
  promotionNames?: ILedgerAccountPromotionNames;
  bankAccount: IBankDetailsCreationReq;
  openingBalance: IOpeningBalanceDto | null;
}
