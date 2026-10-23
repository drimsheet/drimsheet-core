import { IMoneyDto } from '@app/money/dtos/money/money.dto';
import { IDateRangeDto } from '@app/reporting/dtos/date/date-range.dto';

interface IAssetLiabilitySectionDto {
  /** Cumulative balance through period.to, inclusive. */
  total: IMoneyDto;
  /** Cumulative balance through comparisonPeriod.to, inclusive. */
  previousTotal: IMoneyDto;
  /** Total less previous total. */
  change: IMoneyDto;
  /** Change divided by the absolute previous total; null when it is zero. */
  percentageChange: number | null;
}

export interface IAssetLiabilitySummaryDto {
  currencyCode: string;
  period: IDateRangeDto;
  /** Immediately preceding equal-length period, with inclusive dates. */
  comparisonPeriod: IDateRangeDto;
  assets: IAssetLiabilitySectionDto;
  liabilities: IAssetLiabilitySectionDto;
  /** Assets less liabilities: the dashboard's total balance. */
  netAssets: IAssetLiabilitySectionDto;
}
