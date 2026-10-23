import { ICurrency } from '@domain/money/types/currency.types';
import { IMoney } from '@domain/money/types/money.types';
import moneyValue from '@domain/money/values/money.vo';

import { IAssetLiabilitySummaryAggregates } from '@app/reporting/contracts/asset-liability-summary.query.repo.contract';
import { IAssetLiabilitySummaryReport } from '@app/reporting/types/asset-liability-summary.types';
import reportingValidation from '@app/reporting/validations/reporting.validation';

function buildComparison(total: IMoney, previousTotal: IMoney) {
  const change = moneyValue.subtract(total, previousTotal);
  for (const money of [total, previousTotal, change]) {
    reportingValidation.validateAmountLimit(money);
    reportingValidation.validateSafeAmount(money);
  }
  const previousMagnitude =
    previousTotal.amount < 0n
      ? moneyValue.multiply(previousTotal, { numerator: -1, denominator: 1 })
      : previousTotal;

  return {
    total,
    previousTotal,
    change,
    percentageChange: moneyValue.getPercentage(change, previousMagnitude),
  };
}

function buildSection(
  balances: IAssetLiabilitySummaryAggregates['balances'],
  type: 'asset' | 'liability',
  currency: ICurrency
): IAssetLiabilitySummaryReport['assets'] {
  let total = moneyValue.makeZeroAmount(currency);
  let previousTotal = moneyValue.makeZeroAmount(currency);
  for (const balance of balances.filter((item) => item.type === type)) {
    const debits = moneyValue.make(balance.debits, currency, true);
    const credits = moneyValue.make(balance.credits, currency, true);
    const previousDebits = moneyValue.make(
      balance.previousDebits,
      currency,
      true
    );
    const previousCredits = moneyValue.make(
      balance.previousCredits,
      currency,
      true
    );
    const isAsset = type === 'asset';
    total = moneyValue.add(
      total,
      isAsset
        ? moneyValue.subtract(debits, credits)
        : moneyValue.subtract(credits, debits)
    );
    previousTotal = moneyValue.add(
      previousTotal,
      isAsset
        ? moneyValue.subtract(previousDebits, previousCredits)
        : moneyValue.subtract(previousCredits, previousDebits)
    );
  }
  return buildComparison(total, previousTotal);
}

/**
 * Builds signed asset/liability balances and net assets from exact aggregates.
 * Assets are debits less credits; liabilities are credits less debits, so contra
 * activity offsets its account class. Rejects report limits or unsafe amounts.
 */
export default function buildAssetLiabilitySummaryAmountsHelper(
  aggregates: IAssetLiabilitySummaryAggregates,
  currency: ICurrency
) {
  const assets = buildSection(aggregates.balances, 'asset', currency);
  const liabilities = buildSection(aggregates.balances, 'liability', currency);
  const netAssets = buildComparison(
    moneyValue.subtract(assets.total, liabilities.total),
    moneyValue.subtract(assets.previousTotal, liabilities.previousTotal)
  );

  return { assets, liabilities, netAssets };
}
