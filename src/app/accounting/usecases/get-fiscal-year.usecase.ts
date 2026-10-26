/**
 * SUMMARY
 * Retrieves a fiscal year by ID within the selected accounting entity. Returns
 * the fiscal year or rejects when it is not found for that entity.
 *
 * WHEN TO USE
 * Use to inspect an existing year's configuration.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import IFiscalYearRepo from '@domain/accounting/repos/fiscal-year.repo';
import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';

import { getFiscalYearParamsValidationSchema } from '@app/accounting/dtos/fiscal-year/fiscal-year.dto.validation';
import accountingAppError from '@app/accounting/errors/accounting.error';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  fiscalYearRepo: IFiscalYearRepo;
}

export default function makeGetFiscalYearUsecase(deps: IDependencies) {
  return async (id: string): Promise<IFiscalYear> => {
    zodValidationRunner(getFiscalYearParamsValidationSchema, { id });

    const { accountingEntity, correlationId } = deps.appContext.get([
      'accountingEntity',
    ]);

    const fiscalYear = await deps.fiscalYearRepo.findById(
      accountingEntity.id,
      id as TEntityId,
      { correlationId }
    );

    if (!fiscalYear) {
      throw new accountingAppError.FiscalYearNotFound();
    }

    return fiscalYear;
  };
}
