/* tslint:disable */
/* eslint-disable */
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import type { TsoaRoute } from '@tsoa/runtime';
import { ExpressTemplateService, fetchMiddlewares } from '@tsoa/runtime';
// @ts-ignore - no great way to install types from subpackage
import type {
  Request as ExRequest,
  Response as ExResponse,
  RequestHandler,
  Router,
} from 'express';

import { expressAuthentication } from './../src/infra/config/tsoa-express-auth';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { AccountingController } from './../src/interface/http/controllers/accounting.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { AccountsController } from './../src/interface/http/controllers/accounts.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { AuthController } from './../src/interface/http/controllers/auth.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { BankController } from './../src/interface/http/controllers/bank.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { CounterpartyController } from './../src/interface/http/controllers/counterparty.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { CurrencyController } from './../src/interface/http/controllers/currency.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { FileController } from './../src/interface/http/controllers/file.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { JournalEntryController } from './../src/interface/http/controllers/journal-entry.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { LedgerController } from './../src/interface/http/controllers/ledger.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { UserController } from './../src/interface/http/controllers/user.controller';

const expressAuthenticationRecasted = expressAuthentication as (
  req: ExRequest,
  securityName: string,
  scopes?: string[],
  res?: ExResponse
) => Promise<any>;

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

const models: TsoaRoute.Models = {
  TEntityId: {
    dataType: 'refAlias',
    type: {
      dataType: 'intersection',
      subSchemas: [
        { dataType: 'string' },
        {
          dataType: 'nestedObjectLiteral',
          nestedProperties: {
            __brand: { dataType: 'enum', enums: ['uuid'], required: true },
          },
        },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  UAppThemePreference: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { dataType: 'enum', enums: ['light'] },
        { dataType: 'enum', enums: ['dark'] },
        { dataType: 'enum', enums: ['system'] },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  UAppUsageModePreference: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { dataType: 'enum', enums: ['power_user'] },
        { dataType: 'enum', enums: ['non_power_user'] },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IUserAppPreferences: {
    dataType: 'refObject',
    properties: {
      theme: { ref: 'UAppThemePreference' },
      appUsageMode: { ref: 'UAppUsageModePreference', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IUserPreferences: {
    dataType: 'refObject',
    properties: {
      createdBy: { ref: 'TEntityId', required: true },
      userId: { ref: 'TEntityId', required: true },
      lastActiveAccountingEntityId: {
        dataType: 'union',
        subSchemas: [{ ref: 'TEntityId' }, { dataType: 'enum', enums: [null] }],
        required: true,
      },
      appPreferences: { ref: 'IUserAppPreferences', required: true },
      createdAt: { dataType: 'datetime', required: true },
      updatedAt: { dataType: 'datetime', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IApiValidationError: {
    dataType: 'refObject',
    properties: {
      field: { dataType: 'string', required: true },
      message: { dataType: 'string', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  'Record_string.unknown_': {
    dataType: 'refAlias',
    type: {
      dataType: 'nestedObjectLiteral',
      nestedProperties: {},
      additionalProperties: { dataType: 'any' },
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  TErrorCause: {
    dataType: 'refAlias',
    type: { ref: 'Record_string.unknown_', validators: {} },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IHttpErrorDto: {
    dataType: 'refObject',
    properties: {
      name: { dataType: 'string', required: true },
      errorKey: { dataType: 'string', required: true },
      validationErrors: {
        dataType: 'array',
        array: { dataType: 'refObject', ref: 'IApiValidationError' },
      },
      cause: { ref: 'TErrorCause' },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IUserProfileDto: {
    dataType: 'refObject',
    properties: {
      id: { ref: 'TEntityId', required: true },
      email: { dataType: 'string', required: true },
      emailVerified: { dataType: 'boolean', required: true },
      firstName: { dataType: 'string', required: true },
      lastName: { dataType: 'string', required: true },
      createdAt: { dataType: 'datetime', required: true },
      updatedAt: { dataType: 'datetime', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IUserPreferencesUpdateDto: {
    dataType: 'refObject',
    properties: {
      theme: { ref: 'UAppThemePreference' },
      appUsageMode: { ref: 'UAppUsageModePreference' },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ULedgerType: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { dataType: 'enum', enums: ['asset'] },
        { dataType: 'enum', enums: ['liability'] },
        { dataType: 'enum', enums: ['revenue'] },
        { dataType: 'enum', enums: ['expense'] },
        { dataType: 'enum', enums: ['equity'] },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  UNormalBalance: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { dataType: 'enum', enums: ['debit'] },
        { dataType: 'enum', enums: ['credit'] },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ULedgerAccountBehavior: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { dataType: 'enum', enums: ['bank'] },
        { dataType: 'enum', enums: ['petty_cash'] },
        { dataType: 'enum', enums: ['default_cash'] },
        { dataType: 'enum', enums: ['stock_and_etfs'] },
        { dataType: 'enum', enums: ['bonds'] },
        { dataType: 'enum', enums: ['statutory_receivable'] },
        { dataType: 'enum', enums: ['trade_receivable'] },
        { dataType: 'enum', enums: ['default_receivables'] },
        { dataType: 'enum', enums: ['default'] },
        { dataType: 'enum', enums: ['credit_card'] },
        { dataType: 'enum', enums: ['overdraft'] },
        { dataType: 'enum', enums: ['short_term_loan'] },
        { dataType: 'enum', enums: ['default_short_term_debt'] },
        { dataType: 'enum', enums: ['tax_payable'] },
        { dataType: 'enum', enums: ['trade_payable'] },
        { dataType: 'enum', enums: ['default_payable'] },
        { dataType: 'enum', enums: ['mortgage'] },
        { dataType: 'enum', enums: ['other_long_term_loan'] },
        { dataType: 'enum', enums: ['owner_capital'] },
        { dataType: 'enum', enums: ['retained_earnings'] },
        { dataType: 'enum', enums: ['revaluation_reserve'] },
        { dataType: 'enum', enums: ['opening_balance_equity'] },
        { dataType: 'enum', enums: ['sales'] },
        { dataType: 'enum', enums: ['services'] },
        { dataType: 'enum', enums: ['subscriptions'] },
        { dataType: 'enum', enums: ['employment_income'] },
        { dataType: 'enum', enums: ['interest_income'] },
        { dataType: 'enum', enums: ['gain_on_asset_sale'] },
        { dataType: 'enum', enums: ['unrealized_gains'] },
        { dataType: 'enum', enums: ['grants'] },
        { dataType: 'enum', enums: ['gifts'] },
        { dataType: 'enum', enums: ['cogs'] },
        { dataType: 'enum', enums: ['cost_of_services'] },
        { dataType: 'enum', enums: ['cost_of_revenue'] },
        { dataType: 'enum', enums: ['default_direct_cost'] },
        { dataType: 'enum', enums: ['payroll_and_personnel'] },
        { dataType: 'enum', enums: ['rent_and_utilities'] },
        { dataType: 'enum', enums: ['admin_and_general'] },
        { dataType: 'enum', enums: ['marketing_and_selling'] },
        { dataType: 'enum', enums: ['research_and_development'] },
        { dataType: 'enum', enums: ['depreciation_and_amortization'] },
        { dataType: 'enum', enums: ['bank_charge'] },
        { dataType: 'enum', enums: ['finance_cost'] },
        { dataType: 'enum', enums: ['interest'] },
        { dataType: 'enum', enums: ['tax_expense'] },
        { dataType: 'enum', enums: ['unrealized_loss'] },
        { dataType: 'enum', enums: ['asset_disposal_loss'] },
        { dataType: 'enum', enums: ['impairment_loss'] },
        { dataType: 'enum', enums: ['other_loss'] },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ULedgerAccountStatus: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { dataType: 'enum', enums: ['active'] },
        { dataType: 'enum', enums: ['archived'] },
        { dataType: 'enum', enums: ['draft'] },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  UContraAccountRule: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { dataType: 'enum', enums: ['contra_permitted'] },
        { dataType: 'enum', enums: ['contra_not_permitted'] },
        { dataType: 'enum', enums: ['contra_only'] },
        { dataType: 'enum', enums: ['contra_not_applicable'] },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  UAdjunctAccountRule: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { dataType: 'enum', enums: ['adjunct_permitted'] },
        { dataType: 'enum', enums: ['adjunct_not_permitted'] },
        { dataType: 'enum', enums: ['adjunct_only'] },
        { dataType: 'enum', enums: ['adjunct_not_applicable'] },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IMoneyDto: {
    dataType: 'refObject',
    properties: {
      amount: { dataType: 'double', required: true },
      currencyCode: { dataType: 'string', required: true },
      isMinorUnit: { dataType: 'boolean', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ILedgerAccountDto: {
    dataType: 'refObject',
    properties: {
      id: { ref: 'TEntityId', required: true },
      code: { dataType: 'string', required: true },
      materializedPath: { dataType: 'string', required: true },
      accountingEntityId: { ref: 'TEntityId', required: true },
      type: { ref: 'ULedgerType', required: true },
      normalBalance: { ref: 'UNormalBalance', required: true },
      subType: { dataType: 'any', required: true },
      behavior: { ref: 'ULedgerAccountBehavior', required: true },
      isControlAccount: { dataType: 'boolean', required: true },
      controlAccountId: { ref: 'TEntityId' },
      name: { dataType: 'string', required: true },
      status: { ref: 'ULedgerAccountStatus', required: true },
      contraAccountRule: { ref: 'UContraAccountRule', required: true },
      adjunctAccountRule: { ref: 'UAdjunctAccountRule', required: true },
      openingBalanceDate: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'datetime' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      createdBy: { ref: 'TEntityId', required: true },
      createdAt: { dataType: 'datetime', required: true },
      updatedAt: { dataType: 'datetime', required: true },
      deletedAt: { dataType: 'datetime' },
      balance: { ref: 'IMoneyDto', required: true },
      functionalBalance: { ref: 'IMoneyDto', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IPaginationResponseMeta: {
    dataType: 'refObject',
    properties: {
      page: { dataType: 'double', required: true },
      limit: { dataType: 'double', required: true },
      total: { dataType: 'double', required: true },
      totalPages: { dataType: 'double', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IPaginatedResponse_ILedgerAccountDto_: {
    dataType: 'refObject',
    properties: {
      data: {
        dataType: 'array',
        array: { dataType: 'refObject', ref: 'ILedgerAccountDto' },
        required: true,
      },
      meta: { ref: 'IPaginationResponseMeta', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ULedgerAccountSubType: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { dataType: 'enum', enums: ['retained_earnings'] },
        { dataType: 'enum', enums: ['sales'] },
        { dataType: 'enum', enums: ['services'] },
        { dataType: 'enum', enums: ['subscriptions'] },
        { dataType: 'enum', enums: ['employment_income'] },
        { dataType: 'enum', enums: ['interest_income'] },
        { dataType: 'enum', enums: ['gain_on_asset_sale'] },
        { dataType: 'enum', enums: ['unrealized_gains'] },
        { dataType: 'enum', enums: ['grants'] },
        { dataType: 'enum', enums: ['gifts'] },
        { dataType: 'enum', enums: ['payroll_and_personnel'] },
        { dataType: 'enum', enums: ['rent_and_utilities'] },
        { dataType: 'enum', enums: ['admin_and_general'] },
        { dataType: 'enum', enums: ['marketing_and_selling'] },
        { dataType: 'enum', enums: ['research_and_development'] },
        { dataType: 'enum', enums: ['depreciation_and_amortization'] },
        { dataType: 'enum', enums: ['bank_charge'] },
        { dataType: 'enum', enums: ['finance_cost'] },
        { dataType: 'enum', enums: ['interest'] },
        { dataType: 'enum', enums: ['unrealized_loss'] },
        { dataType: 'enum', enums: ['impairment_loss'] },
        { dataType: 'enum', enums: ['other_loss'] },
        { dataType: 'enum', enums: ['cash_and_cash_equivalent'] },
        { dataType: 'enum', enums: ['short_term_investment'] },
        { dataType: 'enum', enums: ['receivables'] },
        { dataType: 'enum', enums: ['inventory'] },
        { dataType: 'enum', enums: ['accrued_income'] },
        { dataType: 'enum', enums: ['prepayments'] },
        { dataType: 'enum', enums: ['long_term_investment'] },
        { dataType: 'enum', enums: ['property_plant_and_equipment'] },
        { dataType: 'enum', enums: ['intangible_assets'] },
        { dataType: 'enum', enums: ['right_of_use_assets'] },
        { dataType: 'enum', enums: ['goodwill'] },
        { dataType: 'enum', enums: ['suspense'] },
        { dataType: 'enum', enums: ['short_term_debt'] },
        { dataType: 'enum', enums: ['payable'] },
        { dataType: 'enum', enums: ['accrued_expense'] },
        { dataType: 'enum', enums: ['deferred_revenue'] },
        { dataType: 'enum', enums: ['long_term_loan'] },
        { dataType: 'enum', enums: ['lease_liability'] },
        { dataType: 'enum', enums: ['provision'] },
        { dataType: 'enum', enums: ['capital'] },
        { dataType: 'enum', enums: ['reserve'] },
        { dataType: 'enum', enums: ['opening_balance'] },
        { dataType: 'enum', enums: ['direct_costs'] },
        { dataType: 'enum', enums: ['income_tax_expense'] },
        { dataType: 'enum', enums: ['loss_on_asset_disposal'] },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ULedgerAccountSortBy: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { dataType: 'enum', enums: ['accountName'] },
        { dataType: 'enum', enums: ['createdAt'] },
        { dataType: 'enum', enums: ['balance'] },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  UPaginationSortDirection: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { dataType: 'enum', enums: ['asc'] },
        { dataType: 'enum', enums: ['desc'] },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  'Pick_IPaginationParams.Exclude_keyofIPaginationParams.offset__': {
    dataType: 'refAlias',
    type: {
      dataType: 'nestedObjectLiteral',
      nestedProperties: {
        limit: { dataType: 'double' },
        orderBy: { dataType: 'string' },
        sortDirection: { ref: 'UPaginationSortDirection' },
        search: { dataType: 'string' },
      },
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IGetLedgerAccountsQuery: {
    dataType: 'refObject',
    properties: {
      limit: { dataType: 'double' },
      orderBy: { ref: 'ULedgerAccountSortBy' },
      sortDirection: { ref: 'UPaginationSortDirection' },
      search: { dataType: 'string' },
      page: { dataType: 'double' },
      status: { ref: 'ULedgerAccountStatus' },
      type: { ref: 'ULedgerType' },
      subType: { ref: 'ULedgerAccountSubType' },
      behavior: { dataType: 'string' },
      isControlAccount: { dataType: 'boolean' },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  UJournalEntrySourceType: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { dataType: 'enum', enums: ['expense'] },
        { dataType: 'enum', enums: ['opening_balance'] },
        { dataType: 'enum', enums: ['sale'] },
        { dataType: 'enum', enums: ['purchase'] },
        { dataType: 'enum', enums: ['credit_note'] },
        { dataType: 'enum', enums: ['debit_note'] },
        { dataType: 'enum', enums: ['transfer'] },
        { dataType: 'enum', enums: ['payment'] },
        { dataType: 'enum', enums: ['receipt'] },
        { dataType: 'enum', enums: ['adjustment'] },
        { dataType: 'enum', enums: ['reversal'] },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IGetPermittedPostingAccountsQuery: {
    dataType: 'refObject',
    properties: {
      sourceType: { ref: 'UJournalEntrySourceType', required: true },
      side: {
        dataType: 'enum',
        enums: ['source', 'destination'],
        required: true,
      },
      filterSuspense: { dataType: 'boolean' },
      currencyCode: { dataType: 'string' },
      page: { dataType: 'double' },
      limit: { dataType: 'double' },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ULedgerAccountBalanceEffect: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { dataType: 'enum', enums: ['increase'] },
        { dataType: 'enum', enums: ['decrease'] },
        { dataType: 'enum', enums: ['noop'] },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  UJournalEntryStatus: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { dataType: 'enum', enums: ['archived'] },
        { dataType: 'enum', enums: ['draft'] },
        { dataType: 'enum', enums: ['posted'] },
        { dataType: 'enum', enums: ['voided'] },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IJournalHeaderDto: {
    dataType: 'refObject',
    properties: {
      sourceType: { ref: 'UJournalEntrySourceType', required: true },
      memo: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'string' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      status: { ref: 'UJournalEntryStatus', required: true },
      effectiveDate: { dataType: 'datetime', required: true },
      postedAt: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'datetime' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      voidedAt: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'datetime' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      voidingEntryId: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'string' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      createdBy: { ref: 'TEntityId', required: true },
      createdAt: { dataType: 'datetime', required: true },
      updatedAt: { dataType: 'datetime', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  UExchangeRateType: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { dataType: 'enum', enums: ['official'] },
        { dataType: 'enum', enums: ['negotiated'] },
        { dataType: 'enum', enums: ['market'] },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IExchangeRate: {
    dataType: 'refObject',
    properties: {
      currencyPair: { dataType: 'string', required: true },
      baseCurrencyCode: { dataType: 'string', required: true },
      targetCurrencyCode: { dataType: 'string', required: true },
      rate: { dataType: 'double', required: true },
      type: { ref: 'UExchangeRateType', required: true },
      asOf: { dataType: 'datetime', required: true },
      source: { dataType: 'string', required: true },
      createdAt: { dataType: 'datetime', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  UJournalSide: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { dataType: 'enum', enums: ['debit'] },
        { dataType: 'enum', enums: ['credit'] },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IAccountTransactionRes: {
    dataType: 'refObject',
    properties: {
      createdBy: { ref: 'TEntityId', required: true },
      id: { dataType: 'string', required: true },
      entryId: { dataType: 'string', required: true },
      accountId: { dataType: 'string', required: true },
      counterpartyId: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'string' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      sequenceOrder: { dataType: 'double', required: true },
      amount: { ref: 'IMoneyDto', required: true },
      exchangeRate: {
        dataType: 'union',
        subSchemas: [
          { ref: 'IExchangeRate' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      functionalAmount: { ref: 'IMoneyDto', required: true },
      side: { ref: 'UJournalSide', required: true },
      description: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'string' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      createdAt: { dataType: 'datetime', required: true },
      updatedAt: { dataType: 'datetime', required: true },
      header: { ref: 'IJournalHeaderDto', required: true },
      balanceEffect: { ref: 'ULedgerAccountBalanceEffect', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IPaginatedResponse_IAccountTransactionRes_: {
    dataType: 'refObject',
    properties: {
      data: {
        dataType: 'array',
        array: { dataType: 'refObject', ref: 'IAccountTransactionRes' },
        required: true,
      },
      meta: { ref: 'IPaginationResponseMeta', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IPaginationDto: {
    dataType: 'refObject',
    properties: {
      limit: { dataType: 'double' },
      orderBy: { dataType: 'string' },
      sortDirection: { ref: 'UPaginationSortDirection' },
      search: { dataType: 'string' },
      page: { dataType: 'double' },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IHeaderAccountNameAliasesReq: {
    dataType: 'refObject',
    properties: {
      cash_and_cash_equivalent: { dataType: 'string' },
      receivables: { dataType: 'string' },
      short_term_debt: { dataType: 'string' },
      payable: { dataType: 'string' },
      retained_earnings: { dataType: 'string' },
      opening_balance: { dataType: 'string' },
      services: { dataType: 'string' },
      employment_income: { dataType: 'string' },
      gain_on_asset_sale: { dataType: 'string' },
      unrealized_gains: { dataType: 'string' },
      grants: { dataType: 'string' },
      gifts: { dataType: 'string' },
      direct_costs: { dataType: 'string' },
      rent_and_utilities: { dataType: 'string' },
      bank_charge: { dataType: 'string' },
      finance_cost: { dataType: 'string' },
      interest: { dataType: 'string' },
      income_tax_expense: { dataType: 'string' },
      unrealized_loss: { dataType: 'string' },
      loss_on_asset_disposal: { dataType: 'string' },
      trade_receivables: { dataType: 'string' },
      statutory_receivables: { dataType: 'string' },
      trade_payables: { dataType: 'string' },
      statutory_payables: { dataType: 'string' },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ULedgerAccountCreationStatus: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { dataType: 'enum', enums: ['active'] },
        { dataType: 'enum', enums: ['draft'] },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IExchangeRateDto: {
    dataType: 'refObject',
    properties: {
      baseCurrencyCode: { dataType: 'string', required: true },
      targetCurrencyCode: { dataType: 'string', required: true },
      rate: { dataType: 'double', required: true },
      type: { ref: 'UExchangeRateType', required: true },
      asOf: { dataType: 'datetime', required: true },
      source: { dataType: 'string', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IOpeningBalanceDto: {
    dataType: 'refObject',
    properties: {
      amount: { ref: 'IMoneyDto', required: true },
      exchangeRate: {
        dataType: 'union',
        subSchemas: [
          { ref: 'IExchangeRateDto' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      date: { dataType: 'datetime', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IPettyCashAccountCreationReq: {
    dataType: 'refObject',
    properties: {
      name: { dataType: 'string', required: true },
      status: { ref: 'ULedgerAccountCreationStatus' },
      currencyCode: { dataType: 'string', required: true },
      isControlAccount: { dataType: 'boolean', required: true },
      controlAccountId: { dataType: 'string' },
      openingBalance: {
        dataType: 'union',
        subSchemas: [
          { ref: 'IOpeningBalanceDto' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IFileAttachment: {
    dataType: 'refObject',
    properties: {
      url: { dataType: 'string', required: true },
      name: { dataType: 'string', required: true },
      type: { dataType: 'string', required: true },
      size: { dataType: 'double', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  UCounterpartyStatus: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { dataType: 'enum', enums: ['active'] },
        { dataType: 'enum', enums: ['archived'] },
        { dataType: 'enum', enums: ['draft'] },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IJournalLineListDto: {
    dataType: 'refObject',
    properties: {
      id: { dataType: 'string', required: true },
      entryId: { dataType: 'string', required: true },
      account: {
        dataType: 'nestedObjectLiteral',
        nestedProperties: {
          name: { dataType: 'string', required: true },
          id: { dataType: 'string', required: true },
        },
        required: true,
      },
      counterparty: {
        dataType: 'union',
        subSchemas: [
          {
            dataType: 'nestedObjectLiteral',
            nestedProperties: {
              status: { ref: 'UCounterpartyStatus', required: true },
              name: { dataType: 'string', required: true },
              id: { dataType: 'string', required: true },
            },
          },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      sequenceOrder: { dataType: 'double', required: true },
      amount: { ref: 'IMoneyDto', required: true },
      exchangeRate: {
        dataType: 'union',
        subSchemas: [
          { ref: 'IExchangeRate' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      functionalAmount: { ref: 'IMoneyDto', required: true },
      side: { ref: 'UJournalSide', required: true },
      description: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'string' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      createdAt: { dataType: 'datetime', required: true },
      updatedAt: { dataType: 'datetime', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IJournalEntryListDto: {
    dataType: 'refObject',
    properties: {
      sourceType: { ref: 'UJournalEntrySourceType', required: true },
      memo: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'string' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      status: { ref: 'UJournalEntryStatus', required: true },
      effectiveDate: { dataType: 'datetime', required: true },
      postedAt: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'datetime' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      voidedAt: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'datetime' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      voidingEntryId: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'string' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      createdBy: { ref: 'TEntityId', required: true },
      createdAt: { dataType: 'datetime', required: true },
      updatedAt: { dataType: 'datetime', required: true },
      id: { dataType: 'string', required: true },
      accountingEntityId: { dataType: 'string', required: true },
      attachments: {
        dataType: 'array',
        array: { dataType: 'refObject', ref: 'IFileAttachment' },
        required: true,
      },
      lines: {
        dataType: 'array',
        array: { dataType: 'refObject', ref: 'IJournalLineListDto' },
        required: true,
      },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IPaginatedResponse_IJournalEntryListDto_: {
    dataType: 'refObject',
    properties: {
      data: {
        dataType: 'array',
        array: { dataType: 'refObject', ref: 'IJournalEntryListDto' },
        required: true,
      },
      meta: { ref: 'IPaginationResponseMeta', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  UJournalEntrySortBy: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { dataType: 'enum', enums: ['createdAt'] },
        { dataType: 'enum', enums: ['effectiveDate'] },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IGetJournalEntriesQuery: {
    dataType: 'refObject',
    properties: {
      limit: { dataType: 'double' },
      orderBy: { ref: 'UJournalEntrySortBy' },
      sortDirection: { ref: 'UPaginationSortDirection' },
      search: { dataType: 'string' },
      page: { dataType: 'double' },
      accountId: { dataType: 'string' },
      counterpartyId: { dataType: 'string' },
      status: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'enum', enums: ['posted'] },
          { dataType: 'enum', enums: ['archived'] },
        ],
      },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IJournalLineDto: {
    dataType: 'refObject',
    properties: {
      createdBy: { ref: 'TEntityId', required: true },
      id: { dataType: 'string', required: true },
      entryId: { dataType: 'string', required: true },
      accountId: { dataType: 'string', required: true },
      counterpartyId: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'string' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      sequenceOrder: { dataType: 'double', required: true },
      amount: { ref: 'IMoneyDto', required: true },
      exchangeRate: {
        dataType: 'union',
        subSchemas: [
          { ref: 'IExchangeRate' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      functionalAmount: { ref: 'IMoneyDto', required: true },
      side: { ref: 'UJournalSide', required: true },
      description: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'string' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      createdAt: { dataType: 'datetime', required: true },
      updatedAt: { dataType: 'datetime', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IJournalEntryDto: {
    dataType: 'refObject',
    properties: {
      sourceType: { ref: 'UJournalEntrySourceType', required: true },
      memo: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'string' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      status: { ref: 'UJournalEntryStatus', required: true },
      effectiveDate: { dataType: 'datetime', required: true },
      postedAt: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'datetime' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      voidedAt: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'datetime' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      voidingEntryId: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'string' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      createdBy: { ref: 'TEntityId', required: true },
      createdAt: { dataType: 'datetime', required: true },
      updatedAt: { dataType: 'datetime', required: true },
      id: { dataType: 'string', required: true },
      accountingEntityId: { dataType: 'string', required: true },
      attachments: {
        dataType: 'array',
        array: { dataType: 'refObject', ref: 'IFileAttachment' },
        required: true,
      },
      lines: {
        dataType: 'array',
        array: { dataType: 'refObject', ref: 'IJournalLineDto' },
        required: true,
      },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  UCounterpartyType: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { dataType: 'enum', enums: ['individual'] },
        { dataType: 'enum', enums: ['organization'] },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IJournalCounterpartyReq: {
    dataType: 'refObject',
    properties: {
      id: { dataType: 'string' },
      name: { dataType: 'string', required: true },
      type: { ref: 'UCounterpartyType' },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IPaymentEntryLineReq: {
    dataType: 'refObject',
    properties: {
      accountId: { dataType: 'string', required: true },
      counterparty: { ref: 'IJournalCounterpartyReq', required: true },
      amount: { ref: 'IMoneyDto', required: true },
      exchangeRate: {
        dataType: 'union',
        subSchemas: [
          { ref: 'IExchangeRateDto' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      description: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'string' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      sequenceOrder: { dataType: 'double', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IPaymentEntryReq: {
    dataType: 'refObject',
    properties: {
      attachmentReferences: {
        dataType: 'array',
        array: { dataType: 'string' },
      },
      sourceLine: { ref: 'IPaymentEntryLineReq', required: true },
      destinationLines: {
        dataType: 'array',
        array: { dataType: 'refObject', ref: 'IPaymentEntryLineReq' },
        required: true,
      },
      effectiveDate: { dataType: 'datetime', required: true },
      postedAt: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'datetime' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      memo: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'string' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IReceiptEntryLineReq: {
    dataType: 'refObject',
    properties: {
      accountId: { dataType: 'string', required: true },
      counterparty: { ref: 'IJournalCounterpartyReq', required: true },
      amount: { ref: 'IMoneyDto', required: true },
      exchangeRate: {
        dataType: 'union',
        subSchemas: [
          { ref: 'IExchangeRateDto' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      description: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'string' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      sequenceOrder: { dataType: 'double', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IReceiptEntryReq: {
    dataType: 'refObject',
    properties: {
      attachmentReferences: {
        dataType: 'array',
        array: { dataType: 'string' },
      },
      sourceLines: {
        dataType: 'array',
        array: { dataType: 'refObject', ref: 'IReceiptEntryLineReq' },
        required: true,
      },
      destinationLine: { ref: 'IReceiptEntryLineReq', required: true },
      effectiveDate: { dataType: 'datetime', required: true },
      postedAt: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'datetime' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      memo: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'string' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ITransferEntryLineReq: {
    dataType: 'refObject',
    properties: {
      accountId: { dataType: 'string', required: true },
      amount: { ref: 'IMoneyDto', required: true },
      exchangeRate: {
        dataType: 'union',
        subSchemas: [
          { ref: 'IExchangeRateDto' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      description: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'string' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      sequenceOrder: { dataType: 'double', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IJournalLineReq: {
    dataType: 'refObject',
    properties: {
      accountId: { dataType: 'string', required: true },
      counterparty: {
        dataType: 'union',
        subSchemas: [
          { ref: 'IJournalCounterpartyReq' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      amount: { ref: 'IMoneyDto', required: true },
      exchangeRate: {
        dataType: 'union',
        subSchemas: [
          { ref: 'IExchangeRateDto' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      description: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'string' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      sequenceOrder: { dataType: 'double', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ITransferEntryReq: {
    dataType: 'refObject',
    properties: {
      attachmentReferences: {
        dataType: 'array',
        array: { dataType: 'string' },
      },
      sourceLine: { ref: 'ITransferEntryLineReq', required: true },
      destinationLine: { ref: 'ITransferEntryLineReq', required: true },
      chargeLines: {
        dataType: 'array',
        array: { dataType: 'refObject', ref: 'IJournalLineReq' },
        required: true,
      },
      effectiveDate: { dataType: 'datetime', required: true },
      postedAt: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'datetime' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      memo: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'string' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  UJournalEntryRectificationMode: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { dataType: 'enum', enums: ['update_draft'] },
        { dataType: 'enum', enums: ['update_meta'] },
        { dataType: 'enum', enums: ['void_and_replace'] },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IJournalEntryRectificationDto: {
    dataType: 'refObject',
    properties: {
      mode: { ref: 'UJournalEntryRectificationMode', required: true },
      originalJournalEntryId: { dataType: 'string', required: true },
      currentJournalEntryId: { dataType: 'string', required: true },
      reversingJournalEntryId: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'string' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      journalEntry: { ref: 'IJournalEntryDto', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IJournalEntryRectificationCounterpartyLineReq: {
    dataType: 'refObject',
    properties: {
      accountId: { dataType: 'string', required: true },
      counterparty: { ref: 'IJournalCounterpartyReq', required: true },
      amount: { ref: 'IMoneyDto', required: true },
      exchangeRate: {
        dataType: 'union',
        subSchemas: [
          { ref: 'IExchangeRateDto' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      description: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'string' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      sequenceOrder: { dataType: 'double', required: true },
      id: { dataType: 'string' },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IPaymentJournalEntryRectificationReq: {
    dataType: 'refObject',
    properties: {
      attachments: {
        dataType: 'array',
        array: { dataType: 'refObject', ref: 'IFileAttachment' },
        required: true,
      },
      effectiveDate: { dataType: 'datetime', required: true },
      postedAt: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'datetime' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      memo: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'string' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      sourceType: { dataType: 'enum', enums: ['payment'], required: true },
      sourceLine: {
        ref: 'IJournalEntryRectificationCounterpartyLineReq',
        required: true,
      },
      destinationLines: {
        dataType: 'array',
        array: {
          dataType: 'refObject',
          ref: 'IJournalEntryRectificationCounterpartyLineReq',
        },
        required: true,
      },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IReceiptJournalEntryRectificationReq: {
    dataType: 'refObject',
    properties: {
      attachments: {
        dataType: 'array',
        array: { dataType: 'refObject', ref: 'IFileAttachment' },
        required: true,
      },
      effectiveDate: { dataType: 'datetime', required: true },
      postedAt: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'datetime' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      memo: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'string' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      sourceType: { dataType: 'enum', enums: ['receipt'], required: true },
      sourceLines: {
        dataType: 'array',
        array: {
          dataType: 'refObject',
          ref: 'IJournalEntryRectificationCounterpartyLineReq',
        },
        required: true,
      },
      destinationLine: {
        ref: 'IJournalEntryRectificationCounterpartyLineReq',
        required: true,
      },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ITransferJournalEntryRectificationLineReq: {
    dataType: 'refObject',
    properties: {
      id: { dataType: 'string' },
      accountId: { dataType: 'string', required: true },
      amount: { ref: 'IMoneyDto', required: true },
      exchangeRate: {
        dataType: 'union',
        subSchemas: [
          { ref: 'IExchangeRateDto' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      description: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'string' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      sequenceOrder: { dataType: 'double', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IJournalEntryRectificationLineReq: {
    dataType: 'refObject',
    properties: {
      accountId: { dataType: 'string', required: true },
      counterparty: {
        dataType: 'union',
        subSchemas: [
          { ref: 'IJournalCounterpartyReq' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      amount: { ref: 'IMoneyDto', required: true },
      exchangeRate: {
        dataType: 'union',
        subSchemas: [
          { ref: 'IExchangeRateDto' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      description: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'string' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      sequenceOrder: { dataType: 'double', required: true },
      id: { dataType: 'string' },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ITransferJournalEntryRectificationReq: {
    dataType: 'refObject',
    properties: {
      attachments: {
        dataType: 'array',
        array: { dataType: 'refObject', ref: 'IFileAttachment' },
        required: true,
      },
      effectiveDate: { dataType: 'datetime', required: true },
      postedAt: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'datetime' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      memo: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'string' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
      sourceType: { dataType: 'enum', enums: ['transfer'], required: true },
      sourceLine: {
        ref: 'ITransferJournalEntryRectificationLineReq',
        required: true,
      },
      destinationLine: {
        ref: 'ITransferJournalEntryRectificationLineReq',
        required: true,
      },
      chargeLines: {
        dataType: 'array',
        array: {
          dataType: 'refObject',
          ref: 'IJournalEntryRectificationLineReq',
        },
        required: true,
      },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  TJournalEntryRectificationReq: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { ref: 'IPaymentJournalEntryRectificationReq' },
        { ref: 'IReceiptJournalEntryRectificationReq' },
        { ref: 'ITransferJournalEntryRectificationReq' },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  'Readonly_Record_string.string__': {
    dataType: 'refAlias',
    type: {
      dataType: 'nestedObjectLiteral',
      nestedProperties: {},
      additionalProperties: { dataType: 'string' },
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IFileUploadDto: {
    dataType: 'refObject',
    properties: {
      uploadUrl: { dataType: 'string', required: true },
      reference: { dataType: 'string', required: true },
      headers: { ref: 'Readonly_Record_string.string__', required: true },
      file: { ref: 'IFileAttachment', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  UFileUploadPurpose: {
    dataType: 'refAlias',
    type: {
      dataType: 'enum',
      enums: ['journal_entry_attachment'],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IFileUploadReq: {
    dataType: 'refObject',
    properties: {
      name: { dataType: 'string', required: true },
      type: { dataType: 'string', required: true },
      size: { dataType: 'double', required: true },
      purpose: { ref: 'UFileUploadPurpose', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ICurrencyDto: {
    dataType: 'refObject',
    properties: {
      code: { dataType: 'string', required: true },
      symbol: { dataType: 'string', required: true },
      name: { dataType: 'string', required: true },
      minorUnit: { dataType: 'double', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  'Pick_IPaginationDto.Exclude_keyofIPaginationDto.search-or-sortDirection__': {
    dataType: 'refAlias',
    type: {
      dataType: 'nestedObjectLiteral',
      nestedProperties: {
        limit: { dataType: 'double' },
        orderBy: { dataType: 'string' },
        page: { dataType: 'double' },
      },
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IExchangeRateQueryParam: {
    dataType: 'refObject',
    properties: {
      limit: { dataType: 'double' },
      orderBy: { dataType: 'string' },
      page: { dataType: 'double' },
      currencyPair: { dataType: 'string', required: true },
      type: { ref: 'UExchangeRateType' },
      asOf: { dataType: 'datetime' },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  UCounterpartyRole: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { dataType: 'enum', enums: ['employer'] },
        { dataType: 'enum', enums: ['vendor'] },
        { dataType: 'enum', enums: ['contractor'] },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IAddressDto: {
    dataType: 'refObject',
    properties: {
      line1: { dataType: 'string', required: true },
      line2: { dataType: 'string' },
      city: { dataType: 'string', required: true },
      region: { dataType: 'string' },
      postalCode: { dataType: 'string' },
      countryCode: { dataType: 'string', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ICounterpartyMetaDto: {
    dataType: 'refObject',
    properties: {
      employer: {
        dataType: 'nestedObjectLiteral',
        nestedProperties: {
          address: { ref: 'IAddressDto', required: true },
          displayName: {
            dataType: 'union',
            subSchemas: [
              { dataType: 'string' },
              { dataType: 'enum', enums: [null] },
            ],
            required: true,
          },
        },
      },
      vendor: {
        dataType: 'nestedObjectLiteral',
        nestedProperties: {
          address: {
            dataType: 'union',
            subSchemas: [
              { ref: 'IAddressDto' },
              { dataType: 'enum', enums: [null] },
            ],
            required: true,
          },
        },
      },
      contractor: {
        dataType: 'nestedObjectLiteral',
        nestedProperties: { address: { ref: 'IAddressDto', required: true } },
      },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ICounterpartyDto: {
    dataType: 'refObject',
    properties: {
      createdBy: { dataType: 'string', required: true },
      id: { dataType: 'string', required: true },
      accountingEntityId: { dataType: 'string', required: true },
      name: { dataType: 'string', required: true },
      status: { ref: 'UCounterpartyStatus', required: true },
      type: { ref: 'UCounterpartyType', required: true },
      roles: {
        dataType: 'array',
        array: { dataType: 'refAlias', ref: 'UCounterpartyRole' },
        required: true,
      },
      meta: { ref: 'ICounterpartyMetaDto', required: true },
      createdAt: { dataType: 'datetime', required: true },
      updatedAt: { dataType: 'datetime', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IPaginatedResponse_ICounterpartyDto_: {
    dataType: 'refObject',
    properties: {
      data: {
        dataType: 'array',
        array: { dataType: 'refObject', ref: 'ICounterpartyDto' },
        required: true,
      },
      meta: { ref: 'IPaginationResponseMeta', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  UCounterpartySortBy: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { dataType: 'enum', enums: ['createdAt'] },
        { dataType: 'enum', enums: ['name'] },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IGetCounterpartiesQuery: {
    dataType: 'refObject',
    properties: {
      limit: { dataType: 'double' },
      orderBy: { ref: 'UCounterpartySortBy' },
      sortDirection: { ref: 'UPaginationSortDirection' },
      search: { dataType: 'string' },
      page: { dataType: 'double' },
      roles: {
        dataType: 'array',
        array: { dataType: 'refAlias', ref: 'UCounterpartyRole' },
      },
      type: { ref: 'UCounterpartyType' },
      status: { ref: 'UCounterpartyStatus' },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ICounterpartyDeletionEligibilityDto: {
    dataType: 'refObject',
    properties: {
      canDelete: { dataType: 'boolean', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ICounterpartyCreateMetaReq: {
    dataType: 'refObject',
    properties: {
      employer: {
        dataType: 'nestedObjectLiteral',
        nestedProperties: {
          address: { ref: 'IAddressDto', required: true },
          displayName: {
            dataType: 'union',
            subSchemas: [
              { dataType: 'string' },
              { dataType: 'enum', enums: [null] },
            ],
          },
        },
      },
      vendor: {
        dataType: 'nestedObjectLiteral',
        nestedProperties: {
          address: {
            dataType: 'union',
            subSchemas: [
              { ref: 'IAddressDto' },
              { dataType: 'enum', enums: [null] },
            ],
          },
        },
      },
      contractor: {
        dataType: 'nestedObjectLiteral',
        nestedProperties: { address: { ref: 'IAddressDto', required: true } },
      },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ICounterpartyCreateReq: {
    dataType: 'refObject',
    properties: {
      name: { dataType: 'string', required: true },
      status: { ref: 'UCounterpartyStatus', required: true },
      type: { ref: 'UCounterpartyType', required: true },
      meta: { ref: 'ICounterpartyCreateMetaReq' },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ICounterpartyUpdateReq: {
    dataType: 'refObject',
    properties: {
      name: { dataType: 'string' },
      type: { ref: 'UCounterpartyType' },
      status: { dataType: 'enum', enums: ['active'] },
      meta: { ref: 'ICounterpartyCreateMetaReq' },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IBankDirectoryDto: {
    dataType: 'refObject',
    properties: {
      countryCode: { dataType: 'string', required: true },
      bankCode: { dataType: 'string', required: true },
      bankName: { dataType: 'string', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IGetBanksQuery: {
    dataType: 'refObject',
    properties: {
      countryCode: { dataType: 'string', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IUserSignupReq: {
    dataType: 'refObject',
    properties: {
      firstName: { dataType: 'string', required: true },
      lastName: { dataType: 'string', required: true },
      email: { dataType: 'string', required: true },
      password: { dataType: 'string', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IAccessToken: {
    dataType: 'refObject',
    properties: {
      accessToken: { dataType: 'string', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IVerifyEmailReq: {
    dataType: 'refObject',
    properties: {
      token: { dataType: 'string', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IEmailLoginReq: {
    dataType: 'refObject',
    properties: {
      email: { dataType: 'string', required: true },
      password: { dataType: 'string', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IRequestPasswordResetReq: {
    dataType: 'refObject',
    properties: {
      email: { dataType: 'string', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IResetPasswordReq: {
    dataType: 'refObject',
    properties: {
      token: { dataType: 'string', required: true },
      password: { dataType: 'string', required: true },
      confirmPassword: { dataType: 'string', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IRecommendedBootstrapAccountDto: {
    dataType: 'refObject',
    properties: {
      key: { dataType: 'string', required: true },
      name: { dataType: 'string', required: true },
      type: { dataType: 'string', required: true },
      subType: { dataType: 'string', required: true },
      behavior: { dataType: 'string', required: true },
      isControlAccount: { dataType: 'boolean', required: true },
      controlAccountCode: { dataType: 'string' },
      meta: { dataType: 'enum', enums: [null] },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IRecommendedBootstrapDto: {
    dataType: 'refObject',
    properties: {
      receivables: {
        dataType: 'array',
        array: {
          dataType: 'refObject',
          ref: 'IRecommendedBootstrapAccountDto',
        },
        required: true,
      },
      payables: {
        dataType: 'array',
        array: {
          dataType: 'refObject',
          ref: 'IRecommendedBootstrapAccountDto',
        },
        required: true,
      },
      revenue: {
        dataType: 'array',
        array: {
          dataType: 'refObject',
          ref: 'IRecommendedBootstrapAccountDto',
        },
        required: true,
      },
      expense: {
        dataType: 'array',
        array: {
          dataType: 'refObject',
          ref: 'IRecommendedBootstrapAccountDto',
        },
        required: true,
      },
      suspense: {
        dataType: 'array',
        array: {
          dataType: 'refObject',
          ref: 'IRecommendedBootstrapAccountDto',
        },
        required: true,
      },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IBankDetailsCreationReq: {
    dataType: 'refObject',
    properties: {
      bankName: { dataType: 'string', required: true },
      accountName: { dataType: 'string', required: true },
      accountNumber: { dataType: 'string', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IBankAccountCreationReq: {
    dataType: 'refObject',
    properties: {
      name: { dataType: 'string', required: true },
      status: { ref: 'ULedgerAccountCreationStatus' },
      currencyCode: { dataType: 'string', required: true },
      controlAccountId: { dataType: 'string' },
      bankAccount: { ref: 'IBankDetailsCreationReq', required: true },
      openingBalance: {
        dataType: 'union',
        subSchemas: [
          { ref: 'IOpeningBalanceDto' },
          { dataType: 'enum', enums: [null] },
        ],
        required: true,
      },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ICreateStatutoryReceivableAccountDto: {
    dataType: 'refObject',
    properties: {
      name: { dataType: 'string', required: true },
      status: { ref: 'ULedgerAccountCreationStatus' },
      isControlAccount: { dataType: 'boolean', required: true },
      controlAccountId: { dataType: 'string' },
      currencyCode: { dataType: 'string', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ICreateTradeReceivableAccountDto: {
    dataType: 'refObject',
    properties: {
      name: { dataType: 'string', required: true },
      status: { ref: 'ULedgerAccountCreationStatus' },
      isControlAccount: { dataType: 'boolean', required: true },
      controlAccountId: { dataType: 'string' },
      currencyCode: { dataType: 'string', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  TSupportedExpenseAccountBehavior: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { dataType: 'enum', enums: ['default_direct_cost'] },
        { dataType: 'enum', enums: ['cogs'] },
        { dataType: 'enum', enums: ['cost_of_services'] },
        { dataType: 'enum', enums: ['cost_of_revenue'] },
        { dataType: 'enum', enums: ['rent_and_utilities'] },
        { dataType: 'enum', enums: ['bank_charge'] },
        { dataType: 'enum', enums: ['finance_cost'] },
        { dataType: 'enum', enums: ['interest'] },
        { dataType: 'enum', enums: ['tax_expense'] },
        { dataType: 'enum', enums: ['unrealized_loss'] },
        { dataType: 'enum', enums: ['asset_disposal_loss'] },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ICreateExpenseAccountDto: {
    dataType: 'refObject',
    properties: {
      name: { dataType: 'string', required: true },
      status: { ref: 'ULedgerAccountCreationStatus' },
      isControlAccount: { dataType: 'boolean', required: true },
      controlAccountId: { dataType: 'string' },
      behavior: { ref: 'TSupportedExpenseAccountBehavior', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IStatutoryPayableAccountMeta: {
    dataType: 'refObject',
    properties: {
      taxAuthority: { dataType: 'string', required: true },
      taxType: { dataType: 'string', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ICreateStatutoryPayableAccountDto: {
    dataType: 'refObject',
    properties: {
      name: { dataType: 'string', required: true },
      status: { ref: 'ULedgerAccountCreationStatus' },
      isControlAccount: { dataType: 'boolean', required: true },
      controlAccountId: { dataType: 'string' },
      currencyCode: { dataType: 'string', required: true },
      meta: {
        dataType: 'union',
        subSchemas: [
          { ref: 'IStatutoryPayableAccountMeta' },
          { dataType: 'enum', enums: [null] },
        ],
      },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ICreateTradePayableAccountDto: {
    dataType: 'refObject',
    properties: {
      name: { dataType: 'string', required: true },
      status: { ref: 'ULedgerAccountCreationStatus' },
      isControlAccount: { dataType: 'boolean', required: true },
      controlAccountId: { dataType: 'string' },
      meta: {
        dataType: 'union',
        subSchemas: [
          {
            dataType: 'nestedObjectLiteral',
            nestedProperties: {
              invoiceId: { dataType: 'string', required: true },
              counterpartyId: { dataType: 'string', required: true },
            },
          },
          { dataType: 'enum', enums: [null] },
        ],
      },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  TSupportedRevenueAccountBehavior: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { dataType: 'enum', enums: ['services'] },
        { dataType: 'enum', enums: ['employment_income'] },
        { dataType: 'enum', enums: ['gain_on_asset_sale'] },
        { dataType: 'enum', enums: ['unrealized_gains'] },
        { dataType: 'enum', enums: ['grants'] },
        { dataType: 'enum', enums: ['gifts'] },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ICreateRevenueAccountDto: {
    dataType: 'refObject',
    properties: {
      name: { dataType: 'string', required: true },
      status: { ref: 'ULedgerAccountCreationStatus' },
      isControlAccount: { dataType: 'boolean', required: true },
      controlAccountId: { dataType: 'string' },
      behavior: { ref: 'TSupportedRevenueAccountBehavior', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  ICreateSuspenseAccountDto: {
    dataType: 'refObject',
    properties: {
      name: { dataType: 'string', required: true },
      type: {
        dataType: 'union',
        subSchemas: [
          { dataType: 'enum', enums: ['asset'] },
          { dataType: 'enum', enums: ['liability'] },
        ],
        required: true,
      },
      currencyCode: { dataType: 'string', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  UAccountingEntityType: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { dataType: 'enum', enums: ['individual'] },
        { dataType: 'enum', enums: ['sole_trader'] },
        { dataType: 'enum', enums: ['private_company'] },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  UCurrencyCode: {
    dataType: 'refAlias',
    type: {
      dataType: 'enum',
      enums: [
        'AED',
        'ARS',
        'AUD',
        'BDT',
        'BRL',
        'CAD',
        'CHF',
        'CLP',
        'CNY',
        'COP',
        'CZK',
        'DKK',
        'DZD',
        'EGP',
        'EUR',
        'GBP',
        'GHS',
        'HKD',
        'HUF',
        'IDR',
        'ILS',
        'INR',
        'JPY',
        'KES',
        'KRW',
        'MAD',
        'MXN',
        'MYR',
        'NGN',
        'NOK',
        'NZD',
        'PEN',
        'PHP',
        'PKR',
        'PLN',
        'RON',
        'RUB',
        'SAR',
        'SEK',
        'SGD',
        'THB',
        'TRY',
        'TWD',
        'TZS',
        'UAH',
        'UGX',
        'USD',
        'VND',
        'XAF',
        'XOF',
        'ZAR',
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  UJurisdictionCode: {
    dataType: 'refAlias',
    type: {
      dataType: 'enum',
      enums: [
        'AD',
        'AE',
        'AR',
        'AT',
        'AU',
        'BD',
        'BE',
        'BR',
        'CA',
        'CH',
        'CI',
        'CL',
        'CM',
        'CN',
        'CO',
        'CY',
        'CZ',
        'DE',
        'DK',
        'DZ',
        'EE',
        'EG',
        'ES',
        'FI',
        'FR',
        'GB',
        'GH',
        'GR',
        'HK',
        'HR',
        'HU',
        'ID',
        'IE',
        'IL',
        'IN',
        'IT',
        'JP',
        'KE',
        'KR',
        'LT',
        'LU',
        'LV',
        'MA',
        'MC',
        'MT',
        'MX',
        'MY',
        'NG',
        'NL',
        'NO',
        'NZ',
        'PE',
        'PH',
        'PK',
        'PL',
        'PT',
        'RO',
        'RU',
        'SA',
        'SE',
        'SG',
        'SI',
        'SK',
        'SM',
        'SN',
        'TH',
        'TR',
        'TW',
        'TZ',
        'UA',
        'UG',
        'US',
        'VA',
        'VN',
        'ZA',
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IAccountingEntity: {
    dataType: 'refObject',
    properties: {
      createdBy: { ref: 'TEntityId', required: true },
      id: { ref: 'TEntityId', required: true },
      name: { dataType: 'string', required: true },
      type: { ref: 'UAccountingEntityType', required: true },
      ownerId: { ref: 'TEntityId', required: true },
      functionalCurrencyCode: { ref: 'UCurrencyCode', required: true },
      jurisdictionCode: { ref: 'UJurisdictionCode', required: true },
      createdAt: { dataType: 'datetime', required: true },
      updatedAt: { dataType: 'datetime', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IAccountingStandardDto: {
    dataType: 'refObject',
    properties: {
      individual: {
        dataType: 'array',
        array: { dataType: 'string' },
        required: true,
      },
      sole_trader: {
        dataType: 'array',
        array: { dataType: 'string' },
        required: true,
      },
      private_company: {
        dataType: 'array',
        array: { dataType: 'string' },
        required: true,
      },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IJurisdictionDto: {
    dataType: 'refObject',
    properties: {
      code: { dataType: 'string', required: true },
      name: { dataType: 'string', required: true },
      currencyCode: { dataType: 'string', required: true },
      maxFiscalMonths: { dataType: 'double', required: true },
      accountingStandards: { ref: 'IAccountingStandardDto', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  UAccountingStandardCode: {
    dataType: 'refAlias',
    type: {
      dataType: 'enum',
      enums: [
        'AASB',
        'ASPE',
        'CAS',
        'CGNC',
        'EAS',
        'HGB',
        'HKFRS',
        'IFRS',
        'IND_AS',
        'ISRAELI_GAAP',
        'J_GAAP',
        'K_IFRS',
        'MFRS',
        'NIF',
        'NZ_IFRS',
        'OIC',
        'PCG',
        'PFRS',
        'PGC',
        'PSAK',
        'RAS',
        'RJ',
        'SCF',
        'SFRS',
        'SWISS_GAAP_FER',
        'SYSCOHADA',
        'TFRS',
        'THAI_FRS',
        'TIFRS',
        'UK_GAAP',
        'US_GAAP',
        'VAS',
        'LOCAL_GAAP',
        'CASH_BASIS',
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IFiscalYearCreationDto: {
    dataType: 'refObject',
    properties: {
      startDate: { dataType: 'datetime', required: true },
      endDate: { dataType: 'datetime', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  UPeriodUnit: {
    dataType: 'refAlias',
    type: {
      dataType: 'union',
      subSchemas: [
        { dataType: 'enum', enums: ['day'] },
        { dataType: 'enum', enums: ['week'] },
        { dataType: 'enum', enums: ['month'] },
        { dataType: 'enum', enums: ['quarter'] },
        { dataType: 'enum', enums: ['year'] },
      ],
      validators: {},
    },
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IPeriodCreationDto: {
    dataType: 'refObject',
    properties: {
      unit: { ref: 'UPeriodUnit', required: true },
      count: {
        dataType: 'integer',
        required: true,
        validators: { minimum: { value: 1 }, maximum: { value: 550 } },
      },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IAccountingEntityCreationDto: {
    dataType: 'refObject',
    properties: {
      name: { dataType: 'string', required: true },
      entityType: { ref: 'UAccountingEntityType', required: true },
      jurisdictionCode: { ref: 'UJurisdictionCode', required: true },
      accountingStandardCode: {
        ref: 'UAccountingStandardCode',
        required: true,
      },
      functionalCurrencyCode: { ref: 'UCurrencyCode', required: true },
      reportingCurrencyCode: { ref: 'UCurrencyCode', required: true },
      fiscalYear: { ref: 'IFiscalYearCreationDto', required: true },
      accountingPeriod: { ref: 'IPeriodCreationDto', required: true },
      reportingPeriod: { ref: 'IPeriodCreationDto', required: true },
      appPreferences: { ref: 'IUserAppPreferences', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  IAccountingEntitySwitchReq: {
    dataType: 'refObject',
    properties: {
      accountingEntityId: { dataType: 'string', required: true },
    },
    additionalProperties: false,
  },
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
};
const templateService = new ExpressTemplateService(models, {
  noImplicitAdditionalProperties: 'throw-on-extras',
  bodyCoercion: true,
});

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

export function RegisterRoutes(app: Router) {
  // ###########################################################################################################
  //  NOTE: If you do not see routes for all of your controllers in this file, then you might not have informed tsoa of where to look
  //      Please look into the "controllerPathGlobs" config option described in the readme: https://github.com/lukeautry/tsoa
  // ###########################################################################################################

  const argsUserController_getUserPreferences: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {};
  app.get(
    '/api/v1/users/preferences',
    authenticateMiddleware([{ bearerAuth: [] }]),
    ...fetchMiddlewares<RequestHandler>(UserController),
    ...fetchMiddlewares<RequestHandler>(
      UserController.prototype.getUserPreferences
    ),

    async function UserController_getUserPreferences(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsUserController_getUserPreferences,
          request,
          response,
        });

        const controller = new UserController();

        await templateService.apiHandler({
          methodName: 'getUserPreferences',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsUserController_getAuthUserProfile: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {};
  app.get(
    '/api/v1/users/profile',
    authenticateMiddleware([{ bearerAuth: [] }]),
    ...fetchMiddlewares<RequestHandler>(UserController),
    ...fetchMiddlewares<RequestHandler>(
      UserController.prototype.getAuthUserProfile
    ),

    async function UserController_getAuthUserProfile(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsUserController_getAuthUserProfile,
          request,
          response,
        });

        const controller = new UserController();

        await templateService.apiHandler({
          methodName: 'getAuthUserProfile',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsUserController_updateUserPreferences: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    body: {
      in: 'body',
      name: 'body',
      required: true,
      ref: 'IUserPreferencesUpdateDto',
    },
  };
  app.patch(
    '/api/v1/users/preferences',
    authenticateMiddleware([{ bearerAuth: [] }]),
    ...fetchMiddlewares<RequestHandler>(UserController),
    ...fetchMiddlewares<RequestHandler>(
      UserController.prototype.updateUserPreferences
    ),

    async function UserController_updateUserPreferences(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsUserController_updateUserPreferences,
          request,
          response,
        });

        const controller = new UserController();

        await templateService.apiHandler({
          methodName: 'updateUserPreferences',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsLedgerController_getLedgerAccounts: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    query: {
      in: 'queries',
      name: 'query',
      required: true,
      ref: 'IGetLedgerAccountsQuery',
    },
  };
  app.get(
    '/api/v1/ledger',
    ...fetchMiddlewares<RequestHandler>(LedgerController),
    ...fetchMiddlewares<RequestHandler>(
      LedgerController.prototype.getLedgerAccounts
    ),

    async function LedgerController_getLedgerAccounts(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsLedgerController_getLedgerAccounts,
          request,
          response,
        });

        const controller = new LedgerController();

        await templateService.apiHandler({
          methodName: 'getLedgerAccounts',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsLedgerController_getPermittedPostingAccounts: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    query: {
      in: 'queries',
      name: 'query',
      required: true,
      ref: 'IGetPermittedPostingAccountsQuery',
    },
  };
  app.get(
    '/api/v1/ledger/posting-accounts',
    ...fetchMiddlewares<RequestHandler>(LedgerController),
    ...fetchMiddlewares<RequestHandler>(
      LedgerController.prototype.getPermittedPostingAccounts
    ),

    async function LedgerController_getPermittedPostingAccounts(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsLedgerController_getPermittedPostingAccounts,
          request,
          response,
        });

        const controller = new LedgerController();

        await templateService.apiHandler({
          methodName: 'getPermittedPostingAccounts',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsLedgerController_getLedgerAccount: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    accountId: {
      in: 'path',
      name: 'accountId',
      required: true,
      dataType: 'string',
    },
  };
  app.get(
    '/api/v1/ledger/:accountId',
    ...fetchMiddlewares<RequestHandler>(LedgerController),
    ...fetchMiddlewares<RequestHandler>(
      LedgerController.prototype.getLedgerAccount
    ),

    async function LedgerController_getLedgerAccount(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsLedgerController_getLedgerAccount,
          request,
          response,
        });

        const controller = new LedgerController();

        await templateService.apiHandler({
          methodName: 'getLedgerAccount',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsLedgerController_listTransactions: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    accountId: {
      in: 'path',
      name: 'accountId',
      required: true,
      dataType: 'string',
    },
    pagination: {
      in: 'queries',
      name: 'pagination',
      required: true,
      ref: 'IPaginationDto',
    },
  };
  app.get(
    '/api/v1/ledger/:accountId/transactions',
    ...fetchMiddlewares<RequestHandler>(LedgerController),
    ...fetchMiddlewares<RequestHandler>(
      LedgerController.prototype.listTransactions
    ),

    async function LedgerController_listTransactions(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsLedgerController_listTransactions,
          request,
          response,
        });

        const controller = new LedgerController();

        await templateService.apiHandler({
          methodName: 'listTransactions',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsLedgerController_setupHeaderAccounts: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    body: { in: 'body', name: 'body', ref: 'IHeaderAccountNameAliasesReq' },
  };
  app.post(
    '/api/v1/ledger/header-accounts/setup',
    ...fetchMiddlewares<RequestHandler>(LedgerController),
    ...fetchMiddlewares<RequestHandler>(
      LedgerController.prototype.setupHeaderAccounts
    ),

    async function LedgerController_setupHeaderAccounts(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsLedgerController_setupHeaderAccounts,
          request,
          response,
        });

        const controller = new LedgerController();

        await templateService.apiHandler({
          methodName: 'setupHeaderAccounts',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 201,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsLedgerController_createPettyCashAccount: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    body: {
      in: 'body',
      name: 'body',
      required: true,
      ref: 'IPettyCashAccountCreationReq',
    },
  };
  app.post(
    '/api/v1/ledger/asset/petty-cash',
    ...fetchMiddlewares<RequestHandler>(LedgerController),
    ...fetchMiddlewares<RequestHandler>(
      LedgerController.prototype.createPettyCashAccount
    ),

    async function LedgerController_createPettyCashAccount(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsLedgerController_createPettyCashAccount,
          request,
          response,
        });

        const controller = new LedgerController();

        await templateService.apiHandler({
          methodName: 'createPettyCashAccount',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 201,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsLedgerController_archiveLedgerAccount: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    accountId: {
      in: 'path',
      name: 'accountId',
      required: true,
      dataType: 'string',
    },
  };
  app.post(
    '/api/v1/ledger/:accountId/archive',
    ...fetchMiddlewares<RequestHandler>(LedgerController),
    ...fetchMiddlewares<RequestHandler>(
      LedgerController.prototype.archiveLedgerAccount
    ),

    async function LedgerController_archiveLedgerAccount(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsLedgerController_archiveLedgerAccount,
          request,
          response,
        });

        const controller = new LedgerController();

        await templateService.apiHandler({
          methodName: 'archiveLedgerAccount',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 204,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsJournalEntryController_getJournalEntries: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    query: {
      in: 'queries',
      name: 'query',
      required: true,
      ref: 'IGetJournalEntriesQuery',
    },
  };
  app.get(
    '/api/v1/journal-entries',
    ...fetchMiddlewares<RequestHandler>(JournalEntryController),
    ...fetchMiddlewares<RequestHandler>(
      JournalEntryController.prototype.getJournalEntries
    ),

    async function JournalEntryController_getJournalEntries(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsJournalEntryController_getJournalEntries,
          request,
          response,
        });

        const controller = new JournalEntryController();

        await templateService.apiHandler({
          methodName: 'getJournalEntries',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsJournalEntryController_getJournalEntry: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    id: { in: 'path', name: 'id', required: true, dataType: 'string' },
  };
  app.get(
    '/api/v1/journal-entries/:id',
    ...fetchMiddlewares<RequestHandler>(JournalEntryController),
    ...fetchMiddlewares<RequestHandler>(
      JournalEntryController.prototype.getJournalEntry
    ),

    async function JournalEntryController_getJournalEntry(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsJournalEntryController_getJournalEntry,
          request,
          response,
        });

        const controller = new JournalEntryController();

        await templateService.apiHandler({
          methodName: 'getJournalEntry',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsJournalEntryController_createPayment: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    body: { in: 'body', name: 'body', required: true, ref: 'IPaymentEntryReq' },
  };
  app.post(
    '/api/v1/journal-entries/payment',
    ...fetchMiddlewares<RequestHandler>(JournalEntryController),
    ...fetchMiddlewares<RequestHandler>(
      JournalEntryController.prototype.createPayment
    ),

    async function JournalEntryController_createPayment(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsJournalEntryController_createPayment,
          request,
          response,
        });

        const controller = new JournalEntryController();

        await templateService.apiHandler({
          methodName: 'createPayment',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 201,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsJournalEntryController_createReceipt: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    body: { in: 'body', name: 'body', required: true, ref: 'IReceiptEntryReq' },
  };
  app.post(
    '/api/v1/journal-entries/receipt',
    ...fetchMiddlewares<RequestHandler>(JournalEntryController),
    ...fetchMiddlewares<RequestHandler>(
      JournalEntryController.prototype.createReceipt
    ),

    async function JournalEntryController_createReceipt(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsJournalEntryController_createReceipt,
          request,
          response,
        });

        const controller = new JournalEntryController();

        await templateService.apiHandler({
          methodName: 'createReceipt',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 201,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsJournalEntryController_createTransfer: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    body: {
      in: 'body',
      name: 'body',
      required: true,
      ref: 'ITransferEntryReq',
    },
  };
  app.post(
    '/api/v1/journal-entries/transfer',
    ...fetchMiddlewares<RequestHandler>(JournalEntryController),
    ...fetchMiddlewares<RequestHandler>(
      JournalEntryController.prototype.createTransfer
    ),

    async function JournalEntryController_createTransfer(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsJournalEntryController_createTransfer,
          request,
          response,
        });

        const controller = new JournalEntryController();

        await templateService.apiHandler({
          methodName: 'createTransfer',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 201,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsJournalEntryController_rectifyJournalEntry: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    id: { in: 'path', name: 'id', required: true, dataType: 'string' },
    body: {
      in: 'body',
      name: 'body',
      required: true,
      ref: 'TJournalEntryRectificationReq',
    },
  };
  app.post(
    '/api/v1/journal-entries/:id/rectify',
    ...fetchMiddlewares<RequestHandler>(JournalEntryController),
    ...fetchMiddlewares<RequestHandler>(
      JournalEntryController.prototype.rectifyJournalEntry
    ),

    async function JournalEntryController_rectifyJournalEntry(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsJournalEntryController_rectifyJournalEntry,
          request,
          response,
        });

        const controller = new JournalEntryController();

        await templateService.apiHandler({
          methodName: 'rectifyJournalEntry',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsJournalEntryController_archiveJournalEntry: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    id: { in: 'path', name: 'id', required: true, dataType: 'string' },
  };
  app.post(
    '/api/v1/journal-entries/:id/archive',
    ...fetchMiddlewares<RequestHandler>(JournalEntryController),
    ...fetchMiddlewares<RequestHandler>(
      JournalEntryController.prototype.archiveJournalEntry
    ),

    async function JournalEntryController_archiveJournalEntry(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsJournalEntryController_archiveJournalEntry,
          request,
          response,
        });

        const controller = new JournalEntryController();

        await templateService.apiHandler({
          methodName: 'archiveJournalEntry',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsJournalEntryController_deleteJournalEntry: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    id: { in: 'path', name: 'id', required: true, dataType: 'string' },
  };
  app.delete(
    '/api/v1/journal-entries/:id',
    ...fetchMiddlewares<RequestHandler>(JournalEntryController),
    ...fetchMiddlewares<RequestHandler>(
      JournalEntryController.prototype.deleteJournalEntry
    ),

    async function JournalEntryController_deleteJournalEntry(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsJournalEntryController_deleteJournalEntry,
          request,
          response,
        });

        const controller = new JournalEntryController();

        await templateService.apiHandler({
          methodName: 'deleteJournalEntry',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 204,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsFileController_preSignUploads: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    body: {
      in: 'body',
      name: 'body',
      required: true,
      dataType: 'array',
      array: { dataType: 'refObject', ref: 'IFileUploadReq' },
    },
  };
  app.post(
    '/api/v1/files/upload',
    ...fetchMiddlewares<RequestHandler>(FileController),
    ...fetchMiddlewares<RequestHandler>(
      FileController.prototype.preSignUploads
    ),

    async function FileController_preSignUploads(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsFileController_preSignUploads,
          request,
          response,
        });

        const controller = new FileController();

        await templateService.apiHandler({
          methodName: 'preSignUploads',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsCurrencyController_getAllCurrencies: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {};
  app.get(
    '/api/v1/currencies',
    ...fetchMiddlewares<RequestHandler>(CurrencyController),
    ...fetchMiddlewares<RequestHandler>(
      CurrencyController.prototype.getAllCurrencies
    ),

    async function CurrencyController_getAllCurrencies(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsCurrencyController_getAllCurrencies,
          request,
          response,
        });

        const controller = new CurrencyController();

        await templateService.apiHandler({
          methodName: 'getAllCurrencies',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsCurrencyController_getExchangeRates: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    query: {
      in: 'queries',
      name: 'query',
      required: true,
      ref: 'IExchangeRateQueryParam',
    },
  };
  app.get(
    '/api/v1/currencies/exchange-rates',
    ...fetchMiddlewares<RequestHandler>(CurrencyController),
    ...fetchMiddlewares<RequestHandler>(
      CurrencyController.prototype.getExchangeRates
    ),

    async function CurrencyController_getExchangeRates(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsCurrencyController_getExchangeRates,
          request,
          response,
        });

        const controller = new CurrencyController();

        await templateService.apiHandler({
          methodName: 'getExchangeRates',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsCounterpartyController_getCounterparties: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    query: {
      in: 'queries',
      name: 'query',
      required: true,
      ref: 'IGetCounterpartiesQuery',
    },
  };
  app.get(
    '/api/v1/counterparties',
    ...fetchMiddlewares<RequestHandler>(CounterpartyController),
    ...fetchMiddlewares<RequestHandler>(
      CounterpartyController.prototype.getCounterparties
    ),

    async function CounterpartyController_getCounterparties(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsCounterpartyController_getCounterparties,
          request,
          response,
        });

        const controller = new CounterpartyController();

        await templateService.apiHandler({
          methodName: 'getCounterparties',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsCounterpartyController_getCounterparty: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    id: { in: 'path', name: 'id', required: true, dataType: 'string' },
  };
  app.get(
    '/api/v1/counterparties/:id',
    ...fetchMiddlewares<RequestHandler>(CounterpartyController),
    ...fetchMiddlewares<RequestHandler>(
      CounterpartyController.prototype.getCounterparty
    ),

    async function CounterpartyController_getCounterparty(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsCounterpartyController_getCounterparty,
          request,
          response,
        });

        const controller = new CounterpartyController();

        await templateService.apiHandler({
          methodName: 'getCounterparty',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsCounterpartyController_getCounterpartyDeletionEligibility: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    id: { in: 'path', name: 'id', required: true, dataType: 'string' },
  };
  app.get(
    '/api/v1/counterparties/:id/deletion-eligibility',
    ...fetchMiddlewares<RequestHandler>(CounterpartyController),
    ...fetchMiddlewares<RequestHandler>(
      CounterpartyController.prototype.getCounterpartyDeletionEligibility
    ),

    async function CounterpartyController_getCounterpartyDeletionEligibility(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsCounterpartyController_getCounterpartyDeletionEligibility,
          request,
          response,
        });

        const controller = new CounterpartyController();

        await templateService.apiHandler({
          methodName: 'getCounterpartyDeletionEligibility',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsCounterpartyController_createCounterparty: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    body: {
      in: 'body',
      name: 'body',
      required: true,
      ref: 'ICounterpartyCreateReq',
    },
  };
  app.post(
    '/api/v1/counterparties',
    ...fetchMiddlewares<RequestHandler>(CounterpartyController),
    ...fetchMiddlewares<RequestHandler>(
      CounterpartyController.prototype.createCounterparty
    ),

    async function CounterpartyController_createCounterparty(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsCounterpartyController_createCounterparty,
          request,
          response,
        });

        const controller = new CounterpartyController();

        await templateService.apiHandler({
          methodName: 'createCounterparty',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 201,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsCounterpartyController_updateCounterparty: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    id: { in: 'path', name: 'id', required: true, dataType: 'string' },
    body: {
      in: 'body',
      name: 'body',
      required: true,
      ref: 'ICounterpartyUpdateReq',
    },
  };
  app.patch(
    '/api/v1/counterparties/:id',
    ...fetchMiddlewares<RequestHandler>(CounterpartyController),
    ...fetchMiddlewares<RequestHandler>(
      CounterpartyController.prototype.updateCounterparty
    ),

    async function CounterpartyController_updateCounterparty(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsCounterpartyController_updateCounterparty,
          request,
          response,
        });

        const controller = new CounterpartyController();

        await templateService.apiHandler({
          methodName: 'updateCounterparty',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsCounterpartyController_archiveCounterparty: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    id: { in: 'path', name: 'id', required: true, dataType: 'string' },
  };
  app.post(
    '/api/v1/counterparties/:id/archive',
    ...fetchMiddlewares<RequestHandler>(CounterpartyController),
    ...fetchMiddlewares<RequestHandler>(
      CounterpartyController.prototype.archiveCounterparty
    ),

    async function CounterpartyController_archiveCounterparty(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsCounterpartyController_archiveCounterparty,
          request,
          response,
        });

        const controller = new CounterpartyController();

        await templateService.apiHandler({
          methodName: 'archiveCounterparty',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsCounterpartyController_deleteCounterparty: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    id: { in: 'path', name: 'id', required: true, dataType: 'string' },
  };
  app.delete(
    '/api/v1/counterparties/:id',
    ...fetchMiddlewares<RequestHandler>(CounterpartyController),
    ...fetchMiddlewares<RequestHandler>(
      CounterpartyController.prototype.deleteCounterparty
    ),

    async function CounterpartyController_deleteCounterparty(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsCounterpartyController_deleteCounterparty,
          request,
          response,
        });

        const controller = new CounterpartyController();

        await templateService.apiHandler({
          methodName: 'deleteCounterparty',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 204,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsBankController_getBanks: Record<string, TsoaRoute.ParameterSchema> =
    {
      query: {
        in: 'queries',
        name: 'query',
        required: true,
        ref: 'IGetBanksQuery',
      },
    };
  app.get(
    '/api/v1/banks',
    ...fetchMiddlewares<RequestHandler>(BankController),
    ...fetchMiddlewares<RequestHandler>(BankController.prototype.getBanks),

    async function BankController_getBanks(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsBankController_getBanks,
          request,
          response,
        });

        const controller = new BankController();

        await templateService.apiHandler({
          methodName: 'getBanks',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsAuthController_signupWithEmail: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    body: { in: 'body', name: 'body', required: true, ref: 'IUserSignupReq' },
  };
  app.post(
    '/api/v1/auth/signup-with-email',
    ...fetchMiddlewares<RequestHandler>(AuthController),
    ...fetchMiddlewares<RequestHandler>(
      AuthController.prototype.signupWithEmail
    ),

    async function AuthController_signupWithEmail(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsAuthController_signupWithEmail,
          request,
          response,
        });

        const controller = new AuthController();

        await templateService.apiHandler({
          methodName: 'signupWithEmail',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 201,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsAuthController_verifyEmail: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    payload: {
      in: 'body',
      name: 'payload',
      required: true,
      ref: 'IVerifyEmailReq',
    },
  };
  app.post(
    '/api/v1/auth/signup/complete',
    ...fetchMiddlewares<RequestHandler>(AuthController),
    ...fetchMiddlewares<RequestHandler>(AuthController.prototype.verifyEmail),

    async function AuthController_verifyEmail(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsAuthController_verifyEmail,
          request,
          response,
        });

        const controller = new AuthController();

        await templateService.apiHandler({
          methodName: 'verifyEmail',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsAuthController_loginWithEmail: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    body: { in: 'body', name: 'body', required: true, ref: 'IEmailLoginReq' },
  };
  app.post(
    '/api/v1/auth/login-with-email',
    ...fetchMiddlewares<RequestHandler>(AuthController),
    ...fetchMiddlewares<RequestHandler>(
      AuthController.prototype.loginWithEmail
    ),

    async function AuthController_loginWithEmail(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsAuthController_loginWithEmail,
          request,
          response,
        });

        const controller = new AuthController();

        await templateService.apiHandler({
          methodName: 'loginWithEmail',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsAuthController_loginWithGoogle: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {};
  app.get(
    '/api/v1/auth/google',
    ...fetchMiddlewares<RequestHandler>(AuthController),
    ...fetchMiddlewares<RequestHandler>(
      AuthController.prototype.loginWithGoogle
    ),

    async function AuthController_loginWithGoogle(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsAuthController_loginWithGoogle,
          request,
          response,
        });

        const controller = new AuthController();

        await templateService.apiHandler({
          methodName: 'loginWithGoogle',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 302,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsAuthController_loginWithGoogleCallback: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {};
  app.get(
    '/api/v1/auth/google/callback',
    ...fetchMiddlewares<RequestHandler>(AuthController),
    ...fetchMiddlewares<RequestHandler>(
      AuthController.prototype.loginWithGoogleCallback
    ),

    async function AuthController_loginWithGoogleCallback(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsAuthController_loginWithGoogleCallback,
          request,
          response,
        });

        const controller = new AuthController();

        await templateService.apiHandler({
          methodName: 'loginWithGoogleCallback',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 302,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsAuthController_refreshAccessToken: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {};
  app.post(
    '/api/v1/auth/refresh-access-token',
    ...fetchMiddlewares<RequestHandler>(AuthController),
    ...fetchMiddlewares<RequestHandler>(
      AuthController.prototype.refreshAccessToken
    ),

    async function AuthController_refreshAccessToken(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsAuthController_refreshAccessToken,
          request,
          response,
        });

        const controller = new AuthController();

        await templateService.apiHandler({
          methodName: 'refreshAccessToken',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsAuthController_logout: Record<string, TsoaRoute.ParameterSchema> =
    {};
  app.post(
    '/api/v1/auth/logout',
    ...fetchMiddlewares<RequestHandler>(AuthController),
    ...fetchMiddlewares<RequestHandler>(AuthController.prototype.logout),

    async function AuthController_logout(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsAuthController_logout,
          request,
          response,
        });

        const controller = new AuthController();

        await templateService.apiHandler({
          methodName: 'logout',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsAuthController_getPasswordResetLink: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    payload: {
      in: 'body',
      name: 'payload',
      required: true,
      ref: 'IRequestPasswordResetReq',
    },
  };
  app.post(
    '/api/v1/auth/get-password-reset-link',
    ...fetchMiddlewares<RequestHandler>(AuthController),
    ...fetchMiddlewares<RequestHandler>(
      AuthController.prototype.getPasswordResetLink
    ),

    async function AuthController_getPasswordResetLink(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsAuthController_getPasswordResetLink,
          request,
          response,
        });

        const controller = new AuthController();

        await templateService.apiHandler({
          methodName: 'getPasswordResetLink',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsAuthController_resetPassword: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    payload: {
      in: 'body',
      name: 'payload',
      required: true,
      ref: 'IResetPasswordReq',
    },
  };
  app.post(
    '/api/v1/auth/reset-password',
    ...fetchMiddlewares<RequestHandler>(AuthController),
    ...fetchMiddlewares<RequestHandler>(AuthController.prototype.resetPassword),

    async function AuthController_resetPassword(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsAuthController_resetPassword,
          request,
          response,
        });

        const controller = new AuthController();

        await templateService.apiHandler({
          methodName: 'resetPassword',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsAccountsController_getRecommendedBootstrap: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {};
  app.get(
    '/api/v1/accounts/recommended-bootstrap',
    ...fetchMiddlewares<RequestHandler>(AccountsController),
    ...fetchMiddlewares<RequestHandler>(
      AccountsController.prototype.getRecommendedBootstrap
    ),

    async function AccountsController_getRecommendedBootstrap(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsAccountsController_getRecommendedBootstrap,
          request,
          response,
        });

        const controller = new AccountsController();

        await templateService.apiHandler({
          methodName: 'getRecommendedBootstrap',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsAccountsController_createBankAccount: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    body: {
      in: 'body',
      name: 'body',
      required: true,
      ref: 'IBankAccountCreationReq',
    },
  };
  app.post(
    '/api/v1/accounts/asset/bank',
    ...fetchMiddlewares<RequestHandler>(AccountsController),
    ...fetchMiddlewares<RequestHandler>(
      AccountsController.prototype.createBankAccount
    ),

    async function AccountsController_createBankAccount(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsAccountsController_createBankAccount,
          request,
          response,
        });

        const controller = new AccountsController();

        await templateService.apiHandler({
          methodName: 'createBankAccount',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 201,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsAccountsController_createStatutoryReceivableAccount: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    body: {
      in: 'body',
      name: 'body',
      required: true,
      ref: 'ICreateStatutoryReceivableAccountDto',
    },
  };
  app.post(
    '/api/v1/accounts/asset/receivables/statutory',
    ...fetchMiddlewares<RequestHandler>(AccountsController),
    ...fetchMiddlewares<RequestHandler>(
      AccountsController.prototype.createStatutoryReceivableAccount
    ),

    async function AccountsController_createStatutoryReceivableAccount(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsAccountsController_createStatutoryReceivableAccount,
          request,
          response,
        });

        const controller = new AccountsController();

        await templateService.apiHandler({
          methodName: 'createStatutoryReceivableAccount',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 201,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsAccountsController_createTradeReceivableAccount: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    body: {
      in: 'body',
      name: 'body',
      required: true,
      ref: 'ICreateTradeReceivableAccountDto',
    },
  };
  app.post(
    '/api/v1/accounts/asset/receivables/trade',
    ...fetchMiddlewares<RequestHandler>(AccountsController),
    ...fetchMiddlewares<RequestHandler>(
      AccountsController.prototype.createTradeReceivableAccount
    ),

    async function AccountsController_createTradeReceivableAccount(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsAccountsController_createTradeReceivableAccount,
          request,
          response,
        });

        const controller = new AccountsController();

        await templateService.apiHandler({
          methodName: 'createTradeReceivableAccount',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 201,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsAccountsController_createExpenseAccount: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    body: {
      in: 'body',
      name: 'body',
      required: true,
      ref: 'ICreateExpenseAccountDto',
    },
  };
  app.post(
    '/api/v1/accounts/expenses',
    ...fetchMiddlewares<RequestHandler>(AccountsController),
    ...fetchMiddlewares<RequestHandler>(
      AccountsController.prototype.createExpenseAccount
    ),

    async function AccountsController_createExpenseAccount(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsAccountsController_createExpenseAccount,
          request,
          response,
        });

        const controller = new AccountsController();

        await templateService.apiHandler({
          methodName: 'createExpenseAccount',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 201,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsAccountsController_createStatutoryPayableAccount: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    body: {
      in: 'body',
      name: 'body',
      required: true,
      ref: 'ICreateStatutoryPayableAccountDto',
    },
  };
  app.post(
    '/api/v1/accounts/liability/payables/statutory',
    ...fetchMiddlewares<RequestHandler>(AccountsController),
    ...fetchMiddlewares<RequestHandler>(
      AccountsController.prototype.createStatutoryPayableAccount
    ),

    async function AccountsController_createStatutoryPayableAccount(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsAccountsController_createStatutoryPayableAccount,
          request,
          response,
        });

        const controller = new AccountsController();

        await templateService.apiHandler({
          methodName: 'createStatutoryPayableAccount',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 201,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsAccountsController_createTradePayableAccount: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    body: {
      in: 'body',
      name: 'body',
      required: true,
      ref: 'ICreateTradePayableAccountDto',
    },
  };
  app.post(
    '/api/v1/accounts/liability/payables/trade',
    ...fetchMiddlewares<RequestHandler>(AccountsController),
    ...fetchMiddlewares<RequestHandler>(
      AccountsController.prototype.createTradePayableAccount
    ),

    async function AccountsController_createTradePayableAccount(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsAccountsController_createTradePayableAccount,
          request,
          response,
        });

        const controller = new AccountsController();

        await templateService.apiHandler({
          methodName: 'createTradePayableAccount',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 201,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsAccountsController_createRevenueAccount: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    body: {
      in: 'body',
      name: 'body',
      required: true,
      ref: 'ICreateRevenueAccountDto',
    },
  };
  app.post(
    '/api/v1/accounts/revenues',
    ...fetchMiddlewares<RequestHandler>(AccountsController),
    ...fetchMiddlewares<RequestHandler>(
      AccountsController.prototype.createRevenueAccount
    ),

    async function AccountsController_createRevenueAccount(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsAccountsController_createRevenueAccount,
          request,
          response,
        });

        const controller = new AccountsController();

        await templateService.apiHandler({
          methodName: 'createRevenueAccount',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 201,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsAccountsController_createSuspenseAccount: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    body: {
      in: 'body',
      name: 'body',
      required: true,
      ref: 'ICreateSuspenseAccountDto',
    },
  };
  app.post(
    '/api/v1/accounts/suspense',
    ...fetchMiddlewares<RequestHandler>(AccountsController),
    ...fetchMiddlewares<RequestHandler>(
      AccountsController.prototype.createSuspenseAccount
    ),

    async function AccountsController_createSuspenseAccount(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsAccountsController_createSuspenseAccount,
          request,
          response,
        });

        const controller = new AccountsController();

        await templateService.apiHandler({
          methodName: 'createSuspenseAccount',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 201,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsAccountingController_getUserAccountingEntities: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {};
  app.get(
    '/api/v1/accounting/accounting-entities',
    ...fetchMiddlewares<RequestHandler>(AccountingController),
    ...fetchMiddlewares<RequestHandler>(
      AccountingController.prototype.getUserAccountingEntities
    ),

    async function AccountingController_getUserAccountingEntities(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsAccountingController_getUserAccountingEntities,
          request,
          response,
        });

        const controller = new AccountingController();

        await templateService.apiHandler({
          methodName: 'getUserAccountingEntities',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsAccountingController_getActiveAccountingEntity: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {};
  app.get(
    '/api/v1/accounting/accounting-entity',
    ...fetchMiddlewares<RequestHandler>(AccountingController),
    ...fetchMiddlewares<RequestHandler>(
      AccountingController.prototype.getActiveAccountingEntity
    ),

    async function AccountingController_getActiveAccountingEntity(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsAccountingController_getActiveAccountingEntity,
          request,
          response,
        });

        const controller = new AccountingController();

        await templateService.apiHandler({
          methodName: 'getActiveAccountingEntity',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsAccountingController_getJurisdictions: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {};
  app.get(
    '/api/v1/accounting/jurisdictions',
    ...fetchMiddlewares<RequestHandler>(AccountingController),
    ...fetchMiddlewares<RequestHandler>(
      AccountingController.prototype.getJurisdictions
    ),

    async function AccountingController_getJurisdictions(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsAccountingController_getJurisdictions,
          request,
          response,
        });

        const controller = new AccountingController();

        await templateService.apiHandler({
          methodName: 'getJurisdictions',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsAccountingController_createAccountingEntity: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    body: {
      in: 'body',
      name: 'body',
      required: true,
      ref: 'IAccountingEntityCreationDto',
    },
  };
  app.post(
    '/api/v1/accounting/accounting-entity',
    ...fetchMiddlewares<RequestHandler>(AccountingController),
    ...fetchMiddlewares<RequestHandler>(
      AccountingController.prototype.createAccountingEntity
    ),

    async function AccountingController_createAccountingEntity(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsAccountingController_createAccountingEntity,
          request,
          response,
        });

        const controller = new AccountingController();

        await templateService.apiHandler({
          methodName: 'createAccountingEntity',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 201,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
  const argsAccountingController_switchAccountingEntity: Record<
    string,
    TsoaRoute.ParameterSchema
  > = {
    body: {
      in: 'body',
      name: 'body',
      required: true,
      ref: 'IAccountingEntitySwitchReq',
    },
  };
  app.post(
    '/api/v1/accounting/accounting-entity/switch',
    ...fetchMiddlewares<RequestHandler>(AccountingController),
    ...fetchMiddlewares<RequestHandler>(
      AccountingController.prototype.switchAccountingEntity
    ),

    async function AccountingController_switchAccountingEntity(
      request: ExRequest,
      response: ExResponse,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      let validatedArgs: any[] = [];
      try {
        validatedArgs = templateService.getValidatedArgs({
          args: argsAccountingController_switchAccountingEntity,
          request,
          response,
        });

        const controller = new AccountingController();

        await templateService.apiHandler({
          methodName: 'switchAccountingEntity',
          controller,
          response,
          next,
          validatedArgs,
          successStatus: 200,
        });
      } catch (err) {
        return next(err);
      }
    }
  );
  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

  function authenticateMiddleware(security: TsoaRoute.Security[] = []) {
    return async function runAuthenticationMiddleware(
      request: any,
      response: any,
      next: any
    ) {
      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      // keep track of failed auth attempts so we can hand back the most
      // recent one.  This behavior was previously existing so preserving it
      // here
      const failedAttempts: any[] = [];
      const pushAndRethrow = (error: any) => {
        failedAttempts.push(error);
        throw error;
      };

      const secMethodOrPromises: Promise<any>[] = [];
      for (const secMethod of security) {
        if (Object.keys(secMethod).length > 1) {
          const secMethodAndPromises: Promise<any>[] = [];

          for (const name in secMethod) {
            secMethodAndPromises.push(
              expressAuthenticationRecasted(
                request,
                name,
                secMethod[name],
                response
              ).catch(pushAndRethrow)
            );
          }

          // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

          secMethodOrPromises.push(
            Promise.all(secMethodAndPromises).then((users) => {
              return users[0];
            })
          );
        } else {
          for (const name in secMethod) {
            secMethodOrPromises.push(
              expressAuthenticationRecasted(
                request,
                name,
                secMethod[name],
                response
              ).catch(pushAndRethrow)
            );
          }
        }
      }

      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

      try {
        request['user'] = await Promise.any(secMethodOrPromises);

        // Response was sent in middleware, abort
        if (response.writableEnded) {
          return;
        }

        next();
      } catch (err) {
        // Show most recent error as response
        const error = failedAttempts.pop();
        error.status = error.status || 401;

        // Response was sent in middleware, abort
        if (response.writableEnded) {
          return;
        }
        next(error);
      }

      // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    };
  }

  // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
}

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
