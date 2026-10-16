import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';
import { EAccountingEntityStatus } from '@domain/accounting/types/accounting-entity.types';

import IAppContext from '@app/context/contracts/app-context.contract';

interface IDependencies {
  appContext: IAppContext;
  accountingEntityRepo: IAccountingEntityRepo;
}

export default function makeGetUserAccountingEntitiesUseCase(
  deps: IDependencies
) {
  return async () => {
    const { user, correlationId } = deps.appContext.get(['user']);

    const accountingEntities = await deps.accountingEntityRepo.findByUserId(
      user.id,
      {
        correlationId,
        status: EAccountingEntityStatus.Active,
      }
    );

    return accountingEntities;
  };
}
