import IAppContextService from '@shared/contracts/app-context.service.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import { IAppContextData } from '@app/context/types/app-context.types';
import IUserPreferencesAppService from '@app/user/contracts/user-preferences.service.contract';
import { IUserPreferencesUpdateDto } from '@app/user/dtos/user/user.dto';
import { userPreferencesUpdateDtoSchema } from '@app/user/dtos/user/user.dto.validation';
import { IUserPreferences } from '@app/user/types/user-preferences.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
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
