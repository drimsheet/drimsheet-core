import { IStatutoryPayableAccountMeta } from '@domain/ledger/types/liability-account.types';

export interface ICreateTradePayableAccountDto {
  name: string;
  isControlAccount: boolean;
  /** @format uuid */
  controlAccountId?: string;
  meta?: {
    /** @format uuid */
    counterpartyId: string;
    /** @format uuid */
    invoiceId: string;
  } | null;
}

export interface ICreateStatutoryPayableAccountDto {
  name: string;
  isControlAccount: boolean;
  /** @format uuid */
  controlAccountId?: string;
  currencyCode: string;
  meta?: IStatutoryPayableAccountMeta | null;
}
