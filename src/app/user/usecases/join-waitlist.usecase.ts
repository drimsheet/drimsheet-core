/**
 * SUMMARY
 * Collects a waitlist member once per normalized email and feature.
 * Publishes creation events after successful insertion. Existing membership
 * is a successful no-op; persistence failures propagate without publication.
 *
 * WHEN TO USE
 * Use for public waitlist submissions.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */
import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';

import waitListMemberEntity from '@domain/user/entities/waitlist-member.entity';
import IWaitListMemberRepo from '@domain/user/repos/waitlist-member.repo';
import emailValue from '@domain/user/values/email.vo';

import { IAppContextData } from '@app/context/types/app-context.types';
import { IJoinWaitListDto } from '@app/user/dtos/waitlist-member/waitlist-member.dto';
import { joinWaitListDtoSchema } from '@app/user/dtos/waitlist-member/waitlist-member.dto.validation';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  waitListMemberRepo: IWaitListMemberRepo;
  eventBus: IEventBus;
}

export default function makeJoinWaitListUsecase(deps: IDependencies) {
  return async (payload: IJoinWaitListDto): Promise<void> => {
    zodValidationRunner(joinWaitListDtoSchema, payload);
    const { correlationId, idempotencyKey } = deps.appContext.get();

    const existingMember = await deps.waitListMemberRepo.findByEmailAndFeature(
      emailValue.normalize(payload.email),
      payload.feature,
      { correlationId }
    );
    if (existingMember) {
      return;
    }

    const [member, events] = waitListMemberEntity.make({
      firstName: payload.firstName ?? null,
      lastName: payload.lastName ?? null,
      email: payload.email,
      feature: payload.feature,
    });

    await deps.waitListMemberRepo.create(member, {
      correlationId,
    });

    await deps.eventBus.publish(
      eventValue.enrichAll(events, { correlationId, idempotencyKey })
    );
  };
}
