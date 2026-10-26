import IAppContextService from '@shared/contracts/app-context.service.contract';
import dateUtils from '@shared/utils/date';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import currencyEntity from '@domain/money/entities/currency.entity';

import { IAppContextData } from '@app/context/types/app-context.types';
import IBalanceSeriesQueryRepo from '@app/reporting/contracts/balance-series.query.repo.contract';
import {
  IBalancesByTypeDto,
  IGetBalancesByTypeQuery,
} from '@app/reporting/dtos/balance-series/balance-series.dto';
import { getBalancesByTypeQueryValidationSchema } from '@app/reporting/dtos/balance-series/balance-series.dto.validation';
import dateRangeMapper from '@app/reporting/dtos/date/date-range.dto.mapper';
import buildBalanceSeriesHelper from '@app/reporting/usecases/helpers/build-balance-series.helper';
import reportingValidation from '@app/reporting/validations/reporting.validation';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  balanceSeriesQueryRepo: IBalanceSeriesQueryRepo;
}

export default function makeGetBalancesByTypeUsecase(deps: IDependencies) {
  return async (
    query: IGetBalancesByTypeQuery
  ): Promise<IBalancesByTypeDto> => {
    zodValidationRunner(getBalancesByTypeQueryValidationSchema, query);
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
    const types = [...new Set(query.types)];

    const aggregates = await deps.balanceSeriesQueryRepo.aggregate(
      {
        accountingEntityId: accountingEntity.id,
        currencyCode: currency.code,
        period,
        bucketDays: query.bucketDays,
        filter: { types },
      },
      { correlationId }
    );
    return buildBalanceSeriesHelper(
      period,
      query.bucketDays,
      aggregates,
      currency,
      'type'
    );
  };
}
