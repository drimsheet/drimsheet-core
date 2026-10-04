import IEventBus from '@shared/contracts/event-bus.contract';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';

import IAppContext from '@app/context/contracts/app-context.contract';
import { ICounterpartyArchiveReq } from '@app/counterparty/dtos/counterparty-archive/counterparty-archive.dto';
import { counterpartyArchiveReqValidation } from '@app/counterparty/dtos/counterparty-archive/counterparty-archive.dto.validation';
import { ICounterpartyDto } from '@app/counterparty/dtos/counterparty/counterparty.dto';
import counterpartyDtoMapper from '@app/counterparty/dtos/counterparty/counterparty.dto.mapper';
import counterpartyMutationPolicy from '@app/counterparty/policies/counterparty-mutation.policy';

interface IDependencies {
  appContext: IAppContext;
  counterpartyRepo: ICounterpartyRepo;
  eventBus: IEventBus;
}

export default function makeArchiveCounterpartyUsecase(
  deps: Readonly<IDependencies>
) {
  return async (
    id: string,
    payload: ICounterpartyArchiveReq
  ): Promise<ICounterpartyDto> => {
    stringUtils.validateUUID(id, counterpartyError.InvalidCounterpartyId);
    zodValidationRunner(counterpartyArchiveReqValidation, payload);

    const { actor, accountingEntity, correlationId, idempotencyKey } =
      deps.appContext.get(['actor', 'accountingEntity']);

    const existing = await deps.counterpartyRepo.findById(
      id as TEntityId,
      accountingEntity.id,
      { correlationId }
    );

    const current = counterpartyMutationPolicy.validate({
      id,
      counterparty: existing,
      accountingEntityId: accountingEntity.id,
      expectedVersion: payload.expectedVersion,
    });

    const [archivedCounterparty, events, audit] =
      counterpartyEntity.archive(current);

    if (!audit) {
      return counterpartyDtoMapper.toDto(archivedCounterparty);
    }

    const history = historyValue.make(audit, actor.id, correlationId);

    await deps.counterpartyRepo.update(archivedCounterparty, {
      correlationId,
      expectedVersion: payload.expectedVersion,
      history,
    });

    await deps.eventBus.publish(
      eventValue.enrichAll(events, { correlationId, idempotencyKey })
    );

    return counterpartyDtoMapper.toDto(archivedCounterparty);
  };
}
