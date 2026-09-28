import z from 'zod';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';

const invalidNameKey = new ledgerAccountError.InvalidName().errorKey;
const nameAlias = z
  .string(invalidNameKey)
  .trim()
  .min(2, invalidNameKey)
  .max(100, invalidNameKey)
  .optional();

export const headerAccountNameAliasesReqValidation = z.strictObject(
  {
    cash_and_cash_equivalent: nameAlias,
    receivables: nameAlias,
    short_term_debt: nameAlias,
    payable: nameAlias,
    retained_earnings: nameAlias,
    opening_balance: nameAlias,
    services: nameAlias,
    employment_income: nameAlias,
    gain_on_asset_sale: nameAlias,
    unrealized_gains: nameAlias,
    grants: nameAlias,
    gifts: nameAlias,
    direct_costs: nameAlias,
    rent_and_utilities: nameAlias,
    bank_charge: nameAlias,
    finance_cost: nameAlias,
    interest: nameAlias,
    income_tax_expense: nameAlias,
    unrealized_loss: nameAlias,
    loss_on_asset_disposal: nameAlias,
  },
  { error: invalidNameKey }
);
