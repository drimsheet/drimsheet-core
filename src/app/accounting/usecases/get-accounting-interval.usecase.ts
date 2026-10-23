import IAppContextService from '@shared/contracts/app-context.service.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import IAccountingIntervalRepo from '@domain/accounting/repos/accounting-interval.repo';
import IFiscalYearRepo from '@domain/accounting/repos/fiscal-year.repo';
import { IAccountingInterval } from '@domain/accounting/types/accounting-period.types';

import { getAccountingIntervalParamsValidationSchema } from '@app/accounting/dtos/accounting-interval/accounting-interval.dto.validation';
import accountingAppError from '@app/accounting/errors/accounting.error';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  fiscalYearRepo: IFiscalYearRepo;
  accountingIntervalRepo: IAccountingIntervalRepo;
}

export default function makeGetAccountingIntervalUsecase(deps: IDependencies) {
  return async (fiscalYearId: string): Promise<IAccountingInterval> => {
    zodValidationRunner(getAccountingIntervalParamsValidationSchema, {
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

    const interval = await deps.accountingIntervalRepo.findByFiscalYear(
      accountingEntity.id,
      fiscalYear.id,
      repoOptions
    );
    if (!interval) {
      throw new accountingAppError.AccountingIntervalNotFound();
    }

    return interval;
  };
}
