type TSupportedRevenueAccountBehavior =
  | 'services'
  | 'employment_income'
  | 'gain_on_asset_sale'
  | 'unrealized_gains'
  | 'grants'
  | 'gifts';

export interface ICreateRevenueAccountDto {
  name: string;
  isControlAccount: boolean;
  /** @format uuid */
  controlAccountId?: string;
  behavior: TSupportedRevenueAccountBehavior;
}
