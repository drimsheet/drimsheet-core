import { ICurrency } from '@domain/money/types/currency.types';
import moneyValue from '@domain/money/values/money.vo';

import { IRevenueExpenseSummaryAggregates } from '@app/reporting/contracts/revenue-expense-summary.query.repo.contract';
import reportingError from '@app/reporting/errors/reporting.error';
import { IRevenueExpenseSummaryReport } from '@app/reporting/types/revenue-expense-summary.types';
import reportingValidation from '@app/reporting/validations/reporting.validation';

/** Net revenue is credit less debit; net expenses are debit less credit. */
function buildSection(
  aggregates: IRevenueExpenseSummaryAggregates['accounts'],
  type: 'revenue' | 'expense',
  currency: ICurrency
): IRevenueExpenseSummaryReport['revenue'] {
  let total = moneyValue.makeZeroAmount(currency);
  let previousTotal = moneyValue.makeZeroAmount(currency);
  const accounts: IRevenueExpenseSummaryReport['revenue']['accounts'] = [];

  for (const account of aggregates.filter((item) => item.type === type)) {
    const debits = moneyValue.make(account.debits, currency, true);
    const credits = moneyValue.make(account.credits, currency, true);
    const previousDebits = moneyValue.make(
      account.previousDebits,
      currency,
      true
    );
    const previousCredits = moneyValue.make(
      account.previousCredits,
      currency,
      true
    );
    const isRevenue = type === 'revenue';
    const amount = isRevenue
      ? moneyValue.subtract(credits, debits)
      : moneyValue.subtract(debits, credits);
    const previousAmount = isRevenue
      ? moneyValue.subtract(previousCredits, previousDebits)
      : moneyValue.subtract(previousDebits, previousCredits);
    for (const money of [amount, previousAmount]) {
      reportingValidation.validateAmountLimit(money);
      reportingValidation.validateSafeAmount(money);
    }
    total = moneyValue.add(total, amount);
    previousTotal = moneyValue.add(previousTotal, previousAmount);

    if (amount.amount !== 0n) {
      accounts.push({
        accountId: account.accountId,
        accountName: account.accountName,
        amount,
        sharePercentage: null,
      });
    }
  }

  for (const money of [total, previousTotal]) {
    reportingValidation.validateAmountLimit(money);
    reportingValidation.validateSafeAmount(money);
  }
  for (const account of accounts) {
    account.sharePercentage = moneyValue.getPercentage(account.amount, total);
  }
  accounts.sort((first, second) => {
    if (first.amount.amount === second.amount.amount) {
      return first.accountId.localeCompare(second.accountId);
    }
    return first.amount.amount > second.amount.amount ? -1 : 1;
  });
  const change = moneyValue.subtract(total, previousTotal);
  const previousMagnitude =
    previousTotal.amount < 0n
      ? moneyValue.multiply(previousTotal, { numerator: -1, denominator: 1 })
      : previousTotal;

  return {
    total,
    previousTotal,
    percentageChange: moneyValue.getPercentage(change, previousMagnitude),
    accounts,
  };
}

/** Builds monetary totals, account shares and comparisons from exact aggregates. */
export default function buildRevenueExpenseSummaryAmountsHelper(
  aggregates: IRevenueExpenseSummaryAggregates,
  currency: ICurrency
) {
  const suspenseAmount = moneyValue.make(
    aggregates.suspense.amount,
    currency,
    true
  );
  reportingValidation.validateAmountLimit(suspenseAmount);
  reportingValidation.validateSafeAmount(suspenseAmount);
  const transactionCount = Number(aggregates.suspense.transactionCount);
  const isInvalidSuspense =
    !Number.isSafeInteger(transactionCount) ||
    transactionCount < 0 ||
    suspenseAmount.amount < 0n;
  if (isInvalidSuspense) {
    throw new reportingError.AmountOutOfRange();
  }

  return {
    revenue: buildSection(aggregates.accounts, 'revenue', currency),
    expenses: buildSection(aggregates.accounts, 'expense', currency),
    suspense: { transactionCount, amount: suspenseAmount },
  };
}
