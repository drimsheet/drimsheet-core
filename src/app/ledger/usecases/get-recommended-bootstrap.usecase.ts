import { ASSET_LEDGER_CODES } from '@domain/ledger/config/asset-codes.config';
import { LIABILITY_LEDGER_CODES } from '@domain/ledger/config/liability-codes.config';

import {
  IRecommendedBootstrapAccountDto,
  IRecommendedBootstrapDto,
} from '@app/ledger/dtos/recommended-bootstrap/recommended-bootstrap.dto';

const receivables: IRecommendedBootstrapAccountDto[] = [
  {
    key: 'statutory-receivables-default',
    name: 'Statutory Receivables (Default)',
    type: 'asset',
    subType: 'receivables',
    behavior: 'statutory_receivable',
    isControlAccount: false,
    controlAccountCode: ASSET_LEDGER_CODES.RECEIVABLES.STATUTORY,
  },
];

const payables: IRecommendedBootstrapAccountDto[] = [
  {
    key: 'statutory-payables-default',
    name: 'Statutory Payables (Default)',
    type: 'liability',
    subType: 'payable',
    behavior: 'tax_payable',
    isControlAccount: false,
    controlAccountCode: LIABILITY_LEDGER_CODES.PAYABLES.STATUTORY,
    meta: null,
  },
];

const revenue: IRecommendedBootstrapAccountDto[] = [
  {
    key: 'services-default',
    name: 'Services (Default)',
    type: 'revenue',
    subType: 'services',
    behavior: 'services',
    isControlAccount: false,
    controlAccountCode: '401000',
  },
  {
    key: 'employment-income-default',
    name: 'Employment Income (Default)',
    type: 'revenue',
    subType: 'employment_income',
    behavior: 'employment_income',
    isControlAccount: false,
    controlAccountCode: '403000',
  },
  {
    key: 'gain-on-sale-of-assets-default',
    name: 'Gain on Sale of Assets (Default)',
    type: 'revenue',
    subType: 'gain_on_asset_sale',
    behavior: 'gain_on_asset_sale',
    isControlAccount: false,
    controlAccountCode: '405000',
  },
  {
    key: 'unrealized-gains-default',
    name: 'Unrealized Gains (Default)',
    type: 'revenue',
    subType: 'unrealized_gains',
    behavior: 'unrealized_gains',
    isControlAccount: false,
    controlAccountCode: '406000',
  },
  {
    key: 'grants-default',
    name: 'Grants (Default)',
    type: 'revenue',
    subType: 'grants',
    behavior: 'grants',
    isControlAccount: false,
    controlAccountCode: '407000',
  },
  {
    key: 'gifts-default',
    name: 'Gifts (Default)',
    type: 'revenue',
    subType: 'gifts',
    behavior: 'gifts',
    isControlAccount: false,
    controlAccountCode: '408000',
  },
];

const expense: IRecommendedBootstrapAccountDto[] = [
  {
    key: 'direct-costs-default',
    name: 'Direct Costs (Default)',
    type: 'expense',
    subType: 'direct_costs',
    behavior: 'default_direct_cost',
    isControlAccount: false,
    controlAccountCode: '500000',
  },
  {
    key: 'rent-and-utilities-default',
    name: 'Rent and Utilities (Default)',
    type: 'expense',
    subType: 'rent_and_utilities',
    behavior: 'rent_and_utilities',
    isControlAccount: false,
    controlAccountCode: '502000',
  },
  {
    key: 'bank-charge-default',
    name: 'Bank Charge (Default)',
    type: 'expense',
    subType: 'bank_charge',
    behavior: 'bank_charge',
    isControlAccount: false,
    controlAccountCode: '507000',
  },
  {
    key: 'finance-cost-default',
    name: 'Finance Cost (Default)',
    type: 'expense',
    subType: 'finance_cost',
    behavior: 'finance_cost',
    isControlAccount: false,
    controlAccountCode: '508000',
  },
  {
    key: 'interest-default',
    name: 'Interest (Default)',
    type: 'expense',
    subType: 'interest',
    behavior: 'interest',
    isControlAccount: false,
    controlAccountCode: '509000',
  },
  {
    key: 'tax-expense-default',
    name: 'Tax Expense (Default)',
    type: 'expense',
    subType: 'income_tax_expense',
    behavior: 'tax_expense',
    isControlAccount: false,
    controlAccountCode: '510000',
  },
  {
    key: 'unrealized-loss-default',
    name: 'Unrealized Loss (Default)',
    type: 'expense',
    subType: 'unrealized_loss',
    behavior: 'unrealized_loss',
    isControlAccount: false,
    controlAccountCode: '511000',
  },
  {
    key: 'asset-disposal-loss-default',
    name: 'Asset Disposal Loss (Default)',
    type: 'expense',
    subType: 'loss_on_asset_disposal',
    behavior: 'asset_disposal_loss',
    isControlAccount: false,
    controlAccountCode: '512000',
  },
];

const suspense: IRecommendedBootstrapAccountDto[] = [
  {
    key: 'asset-suspense-account',
    name: 'Asset Suspense Account',
    type: 'asset',
    subType: 'suspense',
    behavior: 'default',
    isControlAccount: false,
  },
  {
    key: 'liability-suspense-account',
    name: 'Liability Suspense Account',
    type: 'liability',
    subType: 'suspense',
    behavior: 'default',
    isControlAccount: false,
  },
];

export default function makeGetRecommendedBootstrapUsecase() {
  return (): IRecommendedBootstrapDto => {
    return { receivables, payables, revenue, expense, suspense };
  };
}
