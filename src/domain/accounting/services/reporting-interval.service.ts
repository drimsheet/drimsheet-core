import dateUtils from '@shared/utils/date';

import reportingIntervalEntity from '@domain/accounting/entities/reporting-interval.entity';
import accountingError from '@domain/accounting/errors/accounting.error';
import periodError from '@domain/accounting/errors/period.error';
import IReportingIntervalRepo from '@domain/accounting/repos/reporting-interval.repo';
import IReportingIntervalService from '@domain/accounting/types/reporting-interval.service.types';

interface IDependencies {
  reportingIntervalRepo: IReportingIntervalRepo;
}

/**
 * Enforces one reporting interval per fiscal year (ACC-RI-001).
 * Storage uniqueness protects against concurrent creation.
 */
function makeCreate(deps: IDependencies): IReportingIntervalService['create'] {
  return async (input, options) => {
    if (input.fiscalYear.accountingEntityId !== input.accountingEntityId) {
      throw new periodError.InvalidFiscalYearId();
    }

    const alreadyExists = await deps.reportingIntervalRepo.existsByFiscalYear(
      input.accountingEntityId,
      input.fiscalYear.id,
      options
    );
    if (alreadyExists) {
      throw new accountingError.ReportingIntervalAlreadyExists();
    }

    return reportingIntervalEntity.make({
      accountingEntityId: input.accountingEntityId,
      fiscalYearId: input.fiscalYear.id,
      createdBy: input.createdBy,
      unit: input.unit,
      count: input.count,
      periods: input.periods,
      startDate: input.fiscalYear.startDate,
      endDate: dateUtils.addUtcUnits(input.fiscalYear.endDate, 1, 'day'),
    });
  };
}

export default function makeReportingIntervalService(
  deps: IDependencies
): IReportingIntervalService {
  return Object.freeze({ create: makeCreate(deps) });
}
