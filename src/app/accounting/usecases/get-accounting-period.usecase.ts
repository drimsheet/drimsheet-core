import IAppContextService from '@shared/contracts/app-context.service.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import IAccountingPeriodRepo from '@domain/accounting/repos/accounting-period.repo';
import { IAccountingPeriod } from '@domain/accounting/types/period.types';

import { getAccountingPeriodParamsValidationSchema } from '@app/accounting/dtos/accounting-period/accounting-period.dto.validation';
import accountingAppError from '@app/accounting/errors/accounting.error';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  accountingPeriodRepo: IAccountingPeriodRepo;
}

export default function makeGetAccountingPeriodUsecase(deps: IDependencies) {
  return async (id: string): Promise<IAccountingPeriod> => {
    zodValidationRunner(getAccountingPeriodParamsValidationSchema, { id });

    const { accountingEntity, correlationId } = deps.appContext.get([
      'accountingEntity',
    ]);

    const accountingPeriod = await deps.accountingPeriodRepo.findById(
      accountingEntity.id,
      id as TEntityId,
      { correlationId }
    );

    if (!accountingPeriod) {
      throw new accountingAppError.AccountingPeriodNotFound();
    }

    return accountingPeriod;
  };
}
