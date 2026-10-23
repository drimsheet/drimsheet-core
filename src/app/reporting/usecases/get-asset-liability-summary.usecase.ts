import IAppContextService from '@shared/contracts/app-context.service.contract';
import { IDateRange } from '@shared/types/date.types';
import dateUtils from '@shared/utils/date';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import currencyEntity from '@domain/money/entities/currency.entity';

import { IAppContextData } from '@app/context/types/app-context.types';
import IAssetLiabilitySummaryQueryRepo from '@app/reporting/contracts/asset-liability-summary.query.repo.contract';
import { IAssetLiabilitySummaryDto } from '@app/reporting/dtos/asset-liability-summary/asset-liability-summary.dto';
import assetLiabilitySummaryMapper from '@app/reporting/dtos/asset-liability-summary/asset-liability-summary.dto.mapper';
import { IDateRangeDto } from '@app/reporting/dtos/date/date-range.dto';
import dateRangeMapper from '@app/reporting/dtos/date/date-range.dto.mapper';
import { dateRangeValidationSchema } from '@app/reporting/dtos/date/date-range.dto.validation';
import reportingError from '@app/reporting/errors/reporting.error';
import buildAssetLiabilitySummaryAmountsHelper from '@app/reporting/usecases/helpers/build-asset-liability-summary-amounts.helper';
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
    const amounts = buildAssetLiabilitySummaryAmountsHelper(
      aggregates,
      currency
    );
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
