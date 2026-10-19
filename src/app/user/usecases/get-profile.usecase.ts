import IAppContextService from '@shared/contracts/app-context.service.contract';
import appError from '@shared/values/errors/app.error';

import { IAppContextData } from '@app/context/types/app-context.types';
import { IUserProfileDto } from '@app/user/dtos/user/user.dto';
import userMapper from '@app/user/dtos/user/user.dto.mapper';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
}

export default function makeGetAuthUserProfileUseCase(deps: IDependencies) {
  return async (): Promise<IUserProfileDto> => {
    const { user } = deps.appContext.get();

    if (!user?.id) {
      throw new appError.Unauthorized();
    }

    return userMapper.toProfileDto(user);
  };
}
