import zodValidationRunner from '@shared/utils/zod-validation-runner';

import IAppContext from '@app/context/contracts/app-context.contract';
import IUserPreferencesAppService from '@app/user/contracts/user-preferences.service.contract';
import { IUserPreferencesUpdateDto } from '@app/user/dtos/user/user.dto';
import { userPreferencesUpdateDtoSchema } from '@app/user/dtos/user/user.dto.validation';
import { IUserPreferences } from '@app/user/types/user-preferences.types';

interface IDependencies {
  appContext: IAppContext;
  userPreferencesAppService: IUserPreferencesAppService;
}

export default function makeUpdateUserPreferencesUsecase(deps: IDependencies) {
  return async (
    payload: IUserPreferencesUpdateDto
  ): Promise<IUserPreferences> => {
    zodValidationRunner(userPreferencesUpdateDtoSchema, payload);

    const { user, actor, correlationId } = deps.appContext.get([
      'user',
      'actor',
    ]);

    const updatePayload = {
      userId: user.id,
      createdBy: actor.id,
      appPreferences: payload,
    };

    return await deps.userPreferencesAppService.update(updatePayload, {
      correlationId,
    });
  };
}
