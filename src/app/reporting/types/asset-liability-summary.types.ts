import { IDateRange } from '@shared/types/date.types';

import { IMoney } from '@domain/money/types/money.types';

interface IAssetLiabilitySection {
  total: IMoney;
  previousTotal: IMoney;
  change: IMoney;
  percentageChange: number | null;
}

export interface IAssetLiabilitySummaryReport {
  period: IDateRange;
  comparisonPeriod: IDateRange;
  assets: IAssetLiabilitySection;
  liabilities: IAssetLiabilitySection;
  netAssets: IAssetLiabilitySection;
}
