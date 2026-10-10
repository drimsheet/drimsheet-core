import { ULedgerAccountCreationStatus } from '@domain/ledger/types/ledger.types';

import { IOpeningBalanceDto } from '@app/journal-entry/dtos/opening-balance/opening-balance.dto';

export interface IPettyCashAccountCreationReq {
  name: string;
  /** Defaults to active when omitted. */
  status?: ULedgerAccountCreationStatus;
  currencyCode: string;
  isControlAccount: boolean;
  controlAccountId?: string;
  openingBalance: IOpeningBalanceDto | null;
}

export interface IPettyCashAccountUpdateReq {
  name?: string;
  openingBalance?: IOpeningBalanceDto;
}

/** Editable bank ledger and bank details; currency is retained. */
export interface IBankAccountUpdateReq {
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
  bankAccount: IBankDetailsCreationReq;
  openingBalance: IOpeningBalanceDto | null;
}
