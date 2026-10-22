import IAppContextService from '@shared/contracts/app-context.service.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import IAccountingPeriodRepo from '@domain/accounting/repos/accounting-period.repo.deprecated';
import IFiscalYearRepo from '@domain/accounting/repos/fiscal-year.repo';
import { IAccountingPeriod } from '@domain/accounting/types/period.types';

import { getAccountingPeriodsParamsValidationSchema } from '@app/accounting/dtos/accounting-period/accounting-period.dto.validation';
import accountingAppError from '@app/accounting/errors/accounting.error';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  fiscalYearRepo: IFiscalYearRepo;
  accountingPeriodRepo: IAccountingPeriodRepo;
}

export default function makeGetAccountingPeriodsUsecase(deps: IDependencies) {
  return async (fiscalYearId: string): Promise<IAccountingPeriod[]> => {
    zodValidationRunner(getAccountingPeriodsParamsValidationSchema, {
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

    return deps.accountingPeriodRepo.findAllByFiscalYear(
      accountingEntity.id,
      fiscalYear.id,
      repoOptions
    );
  };
}
