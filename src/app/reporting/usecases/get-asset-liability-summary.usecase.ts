import IAppContextService from '@shared/contracts/app-context.service.contract';
import { IDateRange } from '@shared/types/date.types';
import dateUtils from '@shared/utils/date';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import currencyEntity from '@domain/money/entities/currency.entity';
import { ICurrency } from '@domain/money/types/currency.types';
import { IMoney } from '@domain/money/types/money.types';
import moneyValue from '@domain/money/values/money.vo';

import { IAppContextData } from '@app/context/types/app-context.types';
import IAssetLiabilitySummaryQueryRepo, {
  IAssetLiabilitySummaryAggregates,
} from '@app/reporting/contracts/asset-liability-summary.query.repo.contract';
import { IAssetLiabilitySummaryDto } from '@app/reporting/dtos/asset-liability-summary/asset-liability-summary.dto';
import assetLiabilitySummaryMapper from '@app/reporting/dtos/asset-liability-summary/asset-liability-summary.dto.mapper';
import { IDateRangeDto } from '@app/reporting/dtos/date/date-range.dto';
import dateRangeMapper from '@app/reporting/dtos/date/date-range.dto.mapper';
import { dateRangeValidationSchema } from '@app/reporting/dtos/date/date-range.dto.validation';
import reportingError from '@app/reporting/errors/reporting.error';
import { IAssetLiabilitySummaryReport } from '@app/reporting/types/asset-liability-summary.types';
import reportingValidation from '@app/reporting/validations/reporting.validation';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  assetLiabilitySummaryQueryRepo: IAssetLiabilitySummaryQueryRepo;
}

export default function makeGetAssetLiabilitySummaryUsecase(
  deps: IDependencies
) {
  return async (query: IDateRangeDto): Promise<IAssetLiabilitySummaryDto> => {
    zodValidationRunner(dateRangeValidationSchema, query);

    const period = dateRangeMapper.fromDto(query);
    const days = dateUtils.getUtcCalendarDistance(
      period.from,
      period.to,
      'day'
    );
    reportingValidation.validatePeriodDays(days);
    const previousFrom = dateUtils.addUtcCalendarUnits(
      period.from,
      -days,
      'day'
    );
    if (previousFrom.getUTCFullYear() < 1) {
      throw new reportingError.InvalidPeriod();
    }
    const comparisonPeriod: IDateRange = {
      from: previousFrom,
      to: dateUtils.addUtcCalendarUnits(period.from, -1, 'day'),
    };

    const { accountingEntity, correlationId } = deps.appContext.get([
      'accountingEntity',
    ]);
    const currency = currencyEntity.getByCode(
      accountingEntity.functionalCurrencyCode
    );
    const aggregates = await deps.assetLiabilitySummaryQueryRepo.aggregate(
      {
        accountingEntityId: accountingEntity.id,
        currencyCode: currency.code,
        period,
        comparisonPeriod,
      },
      { correlationId }
    );
    const amounts = buildAssetLiabilitySummaryAmounts(aggregates, currency);
    const report = {
      period,
      comparisonPeriod,
      assets: amounts.assets,
      liabilities: amounts.liabilities,
      netAssets: amounts.netAssets,
    };
    return assetLiabilitySummaryMapper.toDto(report);
  };
}

/**
 * Builds signed asset/liability balances and net assets from exact aggregates.
 * Assets are debits less credits; liabilities are credits less debits, so contra
 * activity offsets its account class. Rejects report limits or unsafe amounts.
 */
function buildAssetLiabilitySummaryAmounts(
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
