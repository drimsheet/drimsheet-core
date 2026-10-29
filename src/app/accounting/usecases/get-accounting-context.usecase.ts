/**
 * SUMMARY
 * Retrieves the accounting context for a fiscal year in the selected entity.
 * Returns null when the year exists but its context is absent; rejects a
 * missing fiscal year.
 *
 * WHEN TO USE
 * Use to inspect accounting configuration or determine whether setup is needed.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import IAccountingContextRepo from '@domain/accounting/repos/accounting-context.repo';
import IFiscalYearRepo from '@domain/accounting/repos/fiscal-year.repo';
import { IAccountingContext } from '@domain/accounting/types/context.types';

import { getAccountingContextParamsValidationSchema } from '@app/accounting/dtos/accounting-context/accounting-context.dto.validation';
import accountingAppError from '@app/accounting/errors/accounting.error';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  accountingContextRepo: IAccountingContextRepo;
  fiscalYearRepo: IFiscalYearRepo;
}

export default function makeGetAccountingContextUsecase(deps: IDependencies) {
  return async (fiscalYearId: string): Promise<IAccountingContext | null> => {
    zodValidationRunner(getAccountingContextParamsValidationSchema, {
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

    return deps.accountingContextRepo.findByFiscalYear(
      accountingEntity.id,
      fiscalYear.id,
      repoOptions
    );
  };
}
