import reportingPeriodEntity from '@domain/accounting/entities/reporting-period.entity.deprecated';
import periodError from '@domain/accounting/errors/period.error';
import IReportingPeriodRepo from '@domain/accounting/repos/reporting-period.repo.deprecated';
import IReportingPeriodService from '@domain/accounting/types/reporting-period.service.types';

interface IDependencies {
  reportingPeriodRepo: IReportingPeriodRepo;
}

/** Validates ownership and an ungenerated fiscal year before constructing its reporting periods. */
function makeGenerate(
  deps: IDependencies
): IReportingPeriodService['generate'] {
  return async (input, options) => {
    reportingPeriodEntity.validateFiscalYearOwnership(
      input.accountingEntityId,
      input.fiscalYear
    );

    const existingPeriods = await deps.reportingPeriodRepo.findAllByFiscalYear(
      input.accountingEntityId,
      input.fiscalYear.id,
      options
    );
    if (existingPeriods.length > 0) {
      throw new periodError.DuplicateReportingPeriods();
    }

    return reportingPeriodEntity.make(input);
  };
}

export default function makeReportingPeriodService(
  deps: IDependencies
): IReportingPeriodService {
  return Object.freeze({
    generate: makeGenerate(deps),
  });
}
