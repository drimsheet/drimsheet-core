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
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import paginationValue from '@shared/values/pagination/pagination.vo';
import { IPaginatedResponse } from '@shared/values/pagination/types/pagination.types';

import currencyEntity from '@domain/money/entities/currency.entity';
import { ICurrency } from '@domain/money/types/currency.types';
import moneyValue from '@domain/money/values/money.vo';

import { IAppContextData } from '@app/context/types/app-context.types';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import IRevenueExpenseAccountsQueryRepo, {
  IRevenueExpenseAccountBalance,
} from '@app/reporting/contracts/revenue-expense-accounts.query.repo.contract';
import {
  IGetRevenueExpenseAccountsQuery,
  IRevenueExpenseAccountDto,
} from '@app/reporting/dtos/revenue-expense-accounts/revenue-expense-accounts.dto';
import revenueExpenseAccountsMapper from '@app/reporting/dtos/revenue-expense-accounts/revenue-expense-accounts.dto.mapper';
import { getRevenueExpenseAccountsQueryValidationSchema } from '@app/reporting/dtos/revenue-expense-accounts/revenue-expense-accounts.dto.validation';
import reportingError from '@app/reporting/errors/reporting.error';
import { IRevenueExpenseAccount } from '@app/reporting/types/revenue-expense-accounts.types';
import reportingValidation from '@app/reporting/validations/reporting.validation';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  revenueExpenseAccountsQueryRepo: IRevenueExpenseAccountsQueryRepo;
}

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
    const balances = await deps.revenueExpenseAccountsQueryRepo.findAll(
      accountingEntity.id,
      currency.code,
      { correlationId }
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
  balances: IRevenueExpenseAccountBalance[],
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
