/**
 * SUMMARY
 * Selects an accounting entity accessible to the signed-in user. Saves the
 * entity as the user's last active selection, updates the current application
 * context, and returns it. Rejects a missing or inaccessible entity.
 *
 * WHEN TO USE
 * Use when changing which entity the user works in.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';

import { IAccountingEntitySwitchReq } from '@app/accounting/dtos/accounting/accounting.dto';
import { accountingEntitySwitchReqSchema } from '@app/accounting/dtos/accounting/accounting.dto.validation';
import accountingAppError from '@app/accounting/errors/accounting.error';
import { IAppContextData } from '@app/context/types/app-context.types';
import IUserPreferencesAppService from '@app/user/contracts/user-preferences.service.contract';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  accountingEntityRepo: IAccountingEntityRepo;
  userPreferencesAppService: IUserPreferencesAppService;
}

export default function makeSwitchAccountingEntityUsecase(deps: IDependencies) {
  return async (payload: IAccountingEntitySwitchReq) => {
    zodValidationRunner(accountingEntitySwitchReqSchema, payload);

    const { user, actor, correlationId } = deps.appContext.get([
      'user',
      'actor',
    ]);

    const accountingEntity = await deps.accountingEntityRepo.findByIdAndUserId(
      payload.accountingEntityId as TEntityId,
      user.id,
      { correlationId }
    );

    if (!accountingEntity) {
      throw new accountingAppError.ActiveEntityNotFound();
    }

    const updatePayload = {
      userId: user.id,
      createdBy: actor.id,
      lastActiveAccountingEntityId: accountingEntity.id,
    };

    await deps.userPreferencesAppService.update(updatePayload, {
      correlationId,
    });

    deps.appContext.set({ accountingEntity });

    return accountingEntity;
  };
}
