import { ULedgerAccountCreationStatus } from '@domain/ledger/types/ledger.types';
import { IStatutoryPayableAccountMeta } from '@domain/ledger/types/liability-account.types';

export interface ICreateTradePayableAccountDto {
  name: string;
  /** Defaults to active when omitted. */
  status?: ULedgerAccountCreationStatus;
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
  /** Defaults to active when omitted. */
  status?: ULedgerAccountCreationStatus;
  isControlAccount: boolean;
  /** @format uuid */
  controlAccountId?: string;
  currencyCode: string;
  meta?: IStatutoryPayableAccountMeta | null;
}
