/**
 * SUMMARY
 * Retrieves the reporting context for a fiscal year in the selected entity.
 * Returns null when the year exists but its context is absent; rejects a
 * missing fiscal year.
 *
 * WHEN TO USE
 * Use to inspect reporting configuration or determine whether setup is needed.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import IFiscalYearRepo from '@domain/accounting/repos/fiscal-year.repo';
import IReportingContextRepo from '@domain/accounting/repos/reporting-context.repo';
import { IReportingContext } from '@domain/accounting/types/context.types';

import { getReportingContextParamsValidationSchema } from '@app/accounting/dtos/reporting-context/reporting-context.dto.validation';
import accountingAppError from '@app/accounting/errors/accounting.error';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  reportingContextRepo: IReportingContextRepo;
  fiscalYearRepo: IFiscalYearRepo;
}

export default function makeGetReportingContextUsecase(deps: IDependencies) {
  return async (fiscalYearId: string): Promise<IReportingContext | null> => {
    zodValidationRunner(getReportingContextParamsValidationSchema, {
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

    return deps.reportingContextRepo.findByFiscalYear(
      accountingEntity.id,
      fiscalYear.id,
      repoOptions
    );
  };
}
