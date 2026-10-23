import IAppContextService from '@shared/contracts/app-context.service.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import IFiscalYearRepo from '@domain/accounting/repos/fiscal-year.repo';
import IReportingIntervalRepo from '@domain/accounting/repos/reporting-interval.repo';
import { IReportingInterval } from '@domain/accounting/types/reporting-period.types';

import { getReportingIntervalParamsValidationSchema } from '@app/accounting/dtos/reporting-interval/reporting-interval.dto.validation';
import accountingAppError from '@app/accounting/errors/accounting.error';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  fiscalYearRepo: IFiscalYearRepo;
  reportingIntervalRepo: IReportingIntervalRepo;
}

export default function makeGetReportingIntervalUsecase(deps: IDependencies) {
  return async (fiscalYearId: string): Promise<IReportingInterval> => {
    zodValidationRunner(getReportingIntervalParamsValidationSchema, {
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

    const interval = await deps.reportingIntervalRepo.findByFiscalYear(
      accountingEntity.id,
      fiscalYear.id,
      repoOptions
    );
    if (!interval) {
      throw new accountingAppError.ReportingIntervalNotFound();
    }

    return interval;
  };
}
