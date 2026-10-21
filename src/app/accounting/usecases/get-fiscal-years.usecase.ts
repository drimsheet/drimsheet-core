import IAppContextService from '@shared/contracts/app-context.service.contract';

import IFiscalYearRepo from '@domain/accounting/repos/fiscal-year.repo';
import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';

import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  fiscalYearRepo: IFiscalYearRepo;
}

export default function makeGetFiscalYearsUsecase(deps: IDependencies) {
  return async (): Promise<IFiscalYear[]> => {
    const { accountingEntity, correlationId } = deps.appContext.get([
      'accountingEntity',
    ]);

    return deps.fiscalYearRepo.findByAccountingEntityId(accountingEntity.id, {
      correlationId,
    });
  };
}
