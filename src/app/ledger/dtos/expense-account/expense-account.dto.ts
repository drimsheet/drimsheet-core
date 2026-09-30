type TSupportedExpenseAccountBehavior =
  | 'default_direct_cost'
  | 'cogs'
  | 'cost_of_services'
  | 'cost_of_revenue'
  | 'rent_and_utilities'
  | 'bank_charge'
  | 'finance_cost'
  | 'interest'
  | 'tax_expense'
  | 'unrealized_loss'
  | 'asset_disposal_loss';

export interface ICreateExpenseAccountDto {
  name: string;
  isControlAccount: boolean;
  /** @format uuid */
  controlAccountId?: string;
  behavior: TSupportedExpenseAccountBehavior;
}
