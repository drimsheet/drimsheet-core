import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { ERepoLock } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';
import ICounterpartyService from '@domain/counterparty/types/counterparty.service.types';

import IAppContext from '@app/context/contracts/app-context.contract';
import {
  ICounterpartyDto,
  ICounterpartyUpdateReq,
} from '@app/counterparty/dtos/counterparty/counterparty.dto';
import counterpartyDtoMapper from '@app/counterparty/dtos/counterparty/counterparty.dto.mapper';
import { counterpartyUpdateReqValidation } from '@app/counterparty/dtos/counterparty/counterparty.dto.validation';
import counterpartyMutationPolicy from '@app/counterparty/policies/counterparty-mutation.policy';

interface IDependencies {
  repoService: IRepoService;
  appContext: IAppContext;
  counterpartyService: ICounterpartyService;
  counterpartyRepo: ICounterpartyRepo;
  eventBus: IEventBus;
}

export default function makeUpdateCounterpartyUsecase(
  deps: Readonly<IDependencies>
) {
  return async (
    id: string,
    payload: ICounterpartyUpdateReq
  ): Promise<ICounterpartyDto> => {
    stringUtils.validateUUID(id, counterpartyError.InvalidCounterpartyId);
    zodValidationRunner(counterpartyUpdateReqValidation, payload);

    const { actor, accountingEntity, correlationId, idempotencyKey } =
      deps.appContext.get(['actor', 'accountingEntity']);

    const changes = counterpartyDtoMapper.fromUpdateDto(payload);
    const repoOptions = { correlationId, idempotencyKey };

    const transaction = await deps.repoService.createTransaction();

    try {
      const readOptions = { correlationId, tx: transaction.context };

      let existing = await deps.counterpartyRepo.findById(
        id as TEntityId,
        accountingEntity.id,
        readOptions
      );

      let current = counterpartyMutationPolicy.validate({
        id,
        counterparty: existing,
        accountingEntityId: accountingEntity.id,
      });

      const isTypeChange =
        changes.type !== undefined && changes.type !== current.type;
      if (isTypeChange) {
        existing = await deps.counterpartyRepo.findById(
          id as TEntityId,
          accountingEntity.id,
          { ...readOptions, lock: ERepoLock.Update }
        );
        current = counterpartyMutationPolicy.validate({
          id,
          counterparty: existing,
          accountingEntityId: accountingEntity.id,
        });
      }

      const [counterparty, events, audit] =
        await deps.counterpartyService.update(current, changes, readOptions);

      const history = historyValue.make(audit, actor.id, correlationId);

      await deps.counterpartyRepo.update(counterparty, {
        ...readOptions,
        expectedVersion: current.version,
        history,
      });

      await transaction.commit();

      await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));

      return counterpartyDtoMapper.toDto(counterparty);
    } catch (error) {
      return transaction.handleError(error);
    } finally {
      await transaction.dispose();
    }
  };
}
