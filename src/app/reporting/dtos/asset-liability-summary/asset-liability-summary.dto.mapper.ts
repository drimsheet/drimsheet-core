import moneyMapper from '@app/money/dtos/money/money.dto.mapper';
import dateRangeMapper from '@app/reporting/dtos/date/date-range.dto.mapper';
import { IAssetLiabilitySummaryReport } from '@app/reporting/types/asset-liability-summary.types';

import { IAssetLiabilitySummaryDto } from './asset-liability-summary.dto';

function mapSection(section: IAssetLiabilitySummaryReport['assets']) {
  return {
    total: moneyMapper.toDto(section.total),
    previousTotal: moneyMapper.toDto(section.previousTotal),
    change: moneyMapper.toDto(section.change),
    percentageChange: section.percentageChange,
  };
}

function toDto(
  report: IAssetLiabilitySummaryReport
): IAssetLiabilitySummaryDto {
  return {
    currencyCode: report.assets.total.currency.code,
    period: dateRangeMapper.toDto(report.period),
    comparisonPeriod: dateRangeMapper.toDto(report.comparisonPeriod),
    assets: mapSection(report.assets),
    liabilities: mapSection(report.liabilities),
    netAssets: mapSection(report.netAssets),
  };
}

export default Object.freeze({ toDto });
