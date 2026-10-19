import IAppContextService from '@shared/contracts/app-context.service.contract';

import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';

import accountingAppError from '@app/accounting/errors/accounting.error';
import { IAppContextData } from '@app/context/types/app-context.types';
import IUserPreferencesRepo from '@app/user/contracts/user-preferences.repo.contract';

interface IDeps {
  appContext: IAppContextService<IAppContextData>;
  accountingEntityRepo: IAccountingEntityRepo;
  userPreferencesRepo: IUserPreferencesRepo;
}

export default function makeGetCurrentAccountingEntityUseCase(deps: IDeps) {
  return async () => {
    const { correlationId, user } = deps.appContext.get(['user']);
    const repoOptions = { correlationId };

    const preferences = await deps.userPreferencesRepo.findById(
      user.id,
      repoOptions
    );

    const accountingEntityId = preferences?.lastActiveAccountingEntityId;

    if (!accountingEntityId) {
      throw new accountingAppError.ActiveEntityNotFound();
    }

    const accountingEntity = await deps.accountingEntityRepo.findByIdAndUserId(
      accountingEntityId,
      user.id,
      repoOptions
    );

    if (!accountingEntity) {
      throw new accountingAppError.ActiveEntityNotFound();
    }

    return accountingEntity;
  };
}
