/**
 * SUMMARY
 * Lists posting-account rows with functional-currency balances, transaction
 * counts, and revenue or expense share percentages for the selected entity.
 * Revenue and expense shares use the corresponding root-header totals before
 * type filtering, name/code search, and pagination; a zero total yields null.
 * Control accounts contribute to totals but are omitted from the rows. Returns
 * minor-unit amounts and pagination metadata; missing balances or invalid
 * amounts/counts reject.
 *
 * WHEN TO USE
 * Use to browse revenue and expense account balances and their contributions.
 * Use get-revenue-expense-summary for activity within a date range and
 * comparison with the preceding period.
 *
 * SEQUENCE DIAGRAM
 * Not required for this read-only aggregation workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import paginationValue from '@shared/values/pagination/pagination.vo';
import { IPaginatedResponse } from '@shared/values/pagination/types/pagination.types';

import { ULedgerAccountStatus } from '@domain/ledger/types/ledger.types';
import { UCurrencyCode } from '@domain/money/config/currencies.config';
import currencyEntity from '@domain/money/entities/currency.entity';
import { ICurrency } from '@domain/money/types/currency.types';
import moneyValue from '@domain/money/values/money.vo';

import { IAppContextData } from '@app/context/types/app-context.types';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import reportingError from '@app/ledger/errors/reporting.error';
import reportingValidation from '@app/ledger/usecases/reporting/shared/reporting.validation';

import {
  getRevenueExpenseAccountsQueryValidationSchema,
  IGetRevenueExpenseAccountsQuery,
  IRevenueExpenseAccountDto,
  revenueExpenseAccountsMapper,
} from './dto';
import { IRevenueExpenseAccount } from './types';

export interface IGetRevenueExpenseAccountsRepoQueryOutput {
  accountId: string;
  accountName: string;
  code: string;
  type: 'revenue' | 'expense' | 'asset' | 'liability';
  subType: string;
  status: ULedgerAccountStatus;
  isControlAccount: boolean;
  controlAccountId: string | null;
  functionalBalance: bigint | null;
  transactionCount: bigint;
}

export interface IGetRevenueExpenseAccountsRepoQueryInput {
  accountingEntityId: TEntityId;
  currencyCode: UCurrencyCode;
}

/**
 * Reads revenue/expense root headers for denominators and revenue/expense/suspense
 * posting accounts for rows, including zero balances and every account status.
 * Stored balances are eventually consistent. Counts each posting account's own
 * live journal lines in all states, like the account transaction list. Returns
 * accounts in code/ID order before display filtering and pagination.
 */
export type TGetRevenueExpenseAccountsRepoQuery = (
  input: IGetRevenueExpenseAccountsRepoQueryInput,
  options: IReadRepoOptions
) => Promise<IGetRevenueExpenseAccountsRepoQueryOutput[]>;

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  repoQuery: TGetRevenueExpenseAccountsRepoQuery;
}

/**
 * @deprecated
 */
export default function makeGetRevenueExpenseAccountsUsecase(
  deps: IDependencies
) {
  return async (
    query: IGetRevenueExpenseAccountsQuery
  ): Promise<IPaginatedResponse<IRevenueExpenseAccountDto>> => {
    zodValidationRunner(getRevenueExpenseAccountsQueryValidationSchema, query);
    const { accountingEntity, correlationId } = deps.appContext.get([
      'accountingEntity',
    ]);
    const currency = currencyEntity.getByCode(
      accountingEntity.functionalCurrencyCode
    );
    const balances = await deps.repoQuery(
      { accountingEntityId: accountingEntity.id, currencyCode: currency.code },
      {
        correlationId,
      }
    );
    const { accounts, totals } = getAccounts(balances, currency);

    for (const total of Object.values(totals)) {
      reportingValidation.validateAmountLimit(total);
      reportingValidation.validateSafeAmount(total);
    }
    for (const account of accounts) {
      const type = account.type;
      const isRevenueOrExpense = type === 'revenue' || type === 'expense';
      if (isRevenueOrExpense) {
        account.sharePercentage = moneyValue.getPercentage(
          account.amount,
          totals[type]
        );
      }
    }

    const search = query.search?.toLowerCase() ?? '';
    const filteredAccounts = accounts.filter((account) => {
      const matchesType =
        query.type === undefined || account.type === query.type;
      const matchesSearch =
        account.accountName.toLowerCase().includes(search) ||
        account.code.includes(search);
      return matchesType && matchesSearch;
    });
    const limit = paginationValue.getLimit(query.limit);
    const offset = paginationValue.getOffset(
      paginationValue.pageToOffset(query.page, limit)
    );

    return paginationValue.getPaginatedResponse(
      filteredAccounts
        .slice(offset, offset + limit)
        .map((v) => revenueExpenseAccountsMapper.toDto(v)),
      filteredAccounts.length,
      { limit, offset }
    );
  };
}

/** Validates balances, totals root headers, and builds only posting-account rows. */
function getAccounts(
  balances: IGetRevenueExpenseAccountsRepoQueryOutput[],
  currency: ICurrency
) {
  const totals = {
    revenue: moneyValue.makeZeroAmount(currency),
    expense: moneyValue.makeZeroAmount(currency),
  };
  const accounts: IRevenueExpenseAccount[] = [];
  for (const balance of balances) {
    if (balance.functionalBalance === null) {
      throw new ledgerAppError.BalanceNotFound({
        accountId: balance.accountId,
      });
    }

    const amount = moneyValue.make(balance.functionalBalance, currency, true);
    reportingValidation.validateAmountLimit(amount);
    reportingValidation.validateSafeAmount(amount);

    const type = balance.type;
    const isRevenueOrExpense = type === 'revenue' || type === 'expense';
    const isRootHeader =
      balance.isControlAccount && balance.controlAccountId === null;
    const contributesToTypeTotal = isRootHeader && isRevenueOrExpense;
    if (contributesToTypeTotal) {
      totals[type] = moneyValue.add(totals[type], amount);
    }
    if (balance.isControlAccount) {
      continue;
    }

    const transactionCount = Number(balance.transactionCount);
    const isInvalidCount =
      !Number.isSafeInteger(transactionCount) || transactionCount < 0;
    if (isInvalidCount) {
      throw new reportingError.AmountOutOfRange();
    }

    accounts.push({
      accountId: balance.accountId,
      accountName: balance.accountName,
      code: balance.code,
      type: balance.type,
      subType: balance.subType,
      status: balance.status,
      amount,
      sharePercentage: null,
      transactionCount,
    });
  }

  return { accounts, totals };
}
