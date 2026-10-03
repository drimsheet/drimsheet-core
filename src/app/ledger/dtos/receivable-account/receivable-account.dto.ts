import { ULedgerAccountCreationStatus } from '@domain/ledger/types/ledger.types';

export interface ICreateTradeReceivableAccountDto {
  name: string;
  /** Defaults to active when omitted. */
  status?: ULedgerAccountCreationStatus;
  isControlAccount: boolean;
  /** @format uuid */
  controlAccountId?: string;
  currencyCode: string;
}

export interface ICreateStatutoryReceivableAccountDto {
  name: string;
  /** Defaults to active when omitted. */
  status?: ULedgerAccountCreationStatus;
  isControlAccount: boolean;
  /** @format uuid */
  controlAccountId?: string;
  currencyCode: string;
}
