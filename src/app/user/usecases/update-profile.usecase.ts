import IEventBus from '@shared/contracts/event-bus.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import userEntity from '@domain/user/entities/user.entity';
import IUserRepo from '@domain/user/repos/user.repo';

import IAppContext from '@app/context/contracts/app-context.contract';
import {
  IUserProfileDto,
  IUserProfileUpdateDto,
} from '@app/user/dtos/user/user.dto';
import userMapper from '@app/user/dtos/user/user.dto.mapper';
import { userProfileUpdateDtoSchema } from '@app/user/dtos/user/user.dto.validation';

interface IDependencies {
  appContext: IAppContext;
  userRepo: IUserRepo;
  eventBus: IEventBus;
}

export default function makeUpdateAuthUserProfileUsecase(deps: IDependencies) {
  return async (payload: IUserProfileUpdateDto): Promise<IUserProfileDto> => {
    zodValidationRunner(userProfileUpdateDtoSchema, payload);

    const { user, actor, correlationId, idempotencyKey } = deps.appContext.get([
      'user',
      'actor',
    ]);

    const [updatedUser, events, audit] = userEntity.update(user, {
      firstName: payload.firstName,
      lastName: payload.lastName,
    });

    if (audit) {
      // The repository atomically saves the user and history; stale writes conflict.
      await deps.userRepo.update(updatedUser, {
        correlationId,
        expectedVersion: user.version,
        history: historyValue.make(audit, actor.id, correlationId),
      });

      deps.appContext.set({ user: updatedUser });
      await deps.eventBus.publish(
        eventValue.enrichAll(events, { correlationId, idempotencyKey })
      );
    }

    return userMapper.toProfileDto(updatedUser);
  };
}
