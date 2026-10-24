import IAppContextService from '@shared/contracts/app-context.service.contract';
import dateUtils from '@shared/utils/date';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import currencyEntity from '@domain/money/entities/currency.entity';

import { IAppContextData } from '@app/context/types/app-context.types';
import IBalanceSeriesQueryRepo from '@app/reporting/contracts/balance-series.query.repo.contract';
import {
  IBalancesByBehaviorDto,
  IGetBalancesByBehaviorQuery,
} from '@app/reporting/dtos/balance-series/balance-series.dto';
import { getBalancesByBehaviorQueryValidationSchema } from '@app/reporting/dtos/balance-series/balance-series.dto.validation';
import dateRangeMapper from '@app/reporting/dtos/date/date-range.dto.mapper';
import buildBalanceSeriesHelper from '@app/reporting/usecases/helpers/build-balance-series.helper';
import reportingValidation from '@app/reporting/validations/reporting.validation';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  balanceSeriesQueryRepo: IBalanceSeriesQueryRepo;
}

export default function makeGetBalancesByBehaviorUsecase(deps: IDependencies) {
  return async (
    query: IGetBalancesByBehaviorQuery
  ): Promise<IBalancesByBehaviorDto> => {
    zodValidationRunner(getBalancesByBehaviorQueryValidationSchema, query);

    const period = dateRangeMapper.fromDto(query);
    const days = dateUtils.getUtcCalendarDistance(
      period.from,
      period.to,
      'day'
    );
    reportingValidation.validatePeriodDays(days);

    const { accountingEntity, correlationId } = deps.appContext.get([
      'accountingEntity',
    ]);
    const currency = currencyEntity.getByCode(
      accountingEntity.functionalCurrencyCode
    );
    const behaviors = [...new Set(query.behaviors)];

    const aggregates = await deps.balanceSeriesQueryRepo.aggregate(
      {
        accountingEntityId: accountingEntity.id,
        currencyCode: currency.code,
        period,
        bucketDays: query.bucketDays,
        filter: { behaviors },
      },
      { correlationId }
    );
    return buildBalanceSeriesHelper(
      period,
      query.bucketDays,
      aggregates,
      currency,
      'behavior'
    );
  };
}
