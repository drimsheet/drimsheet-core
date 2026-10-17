import IAppContextService from '@shared/contracts/app-context.service.contract';
import { IDateRange } from '@shared/types/date.types';
import dateUtils from '@shared/utils/date';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import currencyEntity from '@domain/money/entities/currency.entity';

import { IAppContextData } from '@app/context/types/app-context.types';
import IRevenueExpenseSummaryQueryRepo from '@app/reporting/contracts/revenue-expense-summary.query.repo.contract';
import { IDateRangeDto } from '@app/reporting/dtos/date/date-range.dto';
import dateRangeMapper from '@app/reporting/dtos/date/date-range.dto.mapper';
import { dateRangeValidationSchema } from '@app/reporting/dtos/date/date-range.dto.validation';
import { IRevenueExpenseSummaryDto } from '@app/reporting/dtos/revenue-expense-summary/revenue-expense-summary.dto';
import revenueExpenseSummaryMapper from '@app/reporting/dtos/revenue-expense-summary/revenue-expense-summary.dto.mapper';
import reportingError from '@app/reporting/errors/reporting.error';
import buildRevenueExpenseSummaryAmountsHelper from '@app/reporting/usecases/helpers/build-revenue-expense-summary-amounts.helper';
import reportingValidation from '@app/reporting/validations/reporting.validation';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  revenueExpenseSummaryQueryRepo: IRevenueExpenseSummaryQueryRepo;
}

export default function makeGetRevenueExpenseSummaryUsecase(
  deps: IDependencies
) {
  return async (query: IDateRangeDto): Promise<IRevenueExpenseSummaryDto> => {
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
    const aggregates = await deps.revenueExpenseSummaryQueryRepo.aggregate(
      {
        accountingEntityId: accountingEntity.id,
        currencyCode: currency.code,
        period,
        comparisonPeriod,
      },
      { correlationId }
    );
    const amounts = buildRevenueExpenseSummaryAmountsHelper(
      aggregates,
      currency
    );
    const report = {
      period,
      comparisonPeriod,
      revenue: amounts.revenue,
      expenses: amounts.expenses,
      suspense: amounts.suspense,
    };
    return revenueExpenseSummaryMapper.toDto(report);
  };
}
