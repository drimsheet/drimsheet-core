export interface ICreateTradeReceivableAccountDto {
  name: string;
  isControlAccount: boolean;
  /** @format uuid */
  controlAccountId?: string;
  currencyCode: string;
}

export interface ICreateStatutoryReceivableAccountDto {
  name: string;
  isControlAccount: boolean;
  /** @format uuid */
  controlAccountId?: string;
  currencyCode: string;
}
