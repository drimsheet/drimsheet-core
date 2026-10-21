import IAppContextService from '@shared/contracts/app-context.service.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import IFiscalYearRepo from '@domain/accounting/repos/fiscal-year.repo';
import IReportingPeriodRepo from '@domain/accounting/repos/reporting-period.repo';
import { IReportingPeriod } from '@domain/accounting/types/period.types';

import { getReportingPeriodsParamsValidationSchema } from '@app/accounting/dtos/reporting-period/reporting-period.dto.validation';
import accountingAppError from '@app/accounting/errors/accounting.error';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  fiscalYearRepo: IFiscalYearRepo;
  reportingPeriodRepo: IReportingPeriodRepo;
}

export default function makeGetReportingPeriodsUsecase(deps: IDependencies) {
  return async (fiscalYearId: string): Promise<IReportingPeriod[]> => {
    zodValidationRunner(getReportingPeriodsParamsValidationSchema, {
      fiscalYearId,
    });

    const { accountingEntity, correlationId } = deps.appContext.get([
      'accountingEntity',
    ]);
    const repoOptions = { correlationId };

    const fiscalYear = await deps.fiscalYearRepo.findById(
      accountingEntity.id,
      fiscalYearId as TEntityId,
      repoOptions
    );
    if (!fiscalYear) {
      throw new accountingAppError.FiscalYearNotFound();
    }

    return deps.reportingPeriodRepo.findAllByFiscalYear(
      accountingEntity.id,
      fiscalYear.id,
      repoOptions
    );
  };
}
