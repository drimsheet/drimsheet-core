/**
 * SUMMARY
 * Creates a counterparty for the selected accounting entity using the current
 * actor. Accepts a name, type, initial status, and optional employer, vendor,
 * or contractor details. Saves the counterparty and creation history, publishes
 * creation and role events, and returns the counterparty with its roles and
 * metadata.
 *
 * WHEN TO USE
 * Use to register a counterparty directly for later use in the entity's
 * transactions.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';
import ICounterpartyService from '@domain/counterparty/types/counterparty.service.types';

import { IAppContextData } from '@app/context/types/app-context.types';
import {
  ICounterpartyCreateReq,
  ICounterpartyDto,
} from '@app/counterparty/dtos/counterparty/counterparty.dto';
import counterpartyDtoMapper from '@app/counterparty/dtos/counterparty/counterparty.dto.mapper';
import { counterpartyCreateReqValidation } from '@app/counterparty/dtos/counterparty/counterparty.dto.validation';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  counterpartyService: ICounterpartyService;
  counterpartyRepo: ICounterpartyRepo;
  eventBus: IEventBus;
}

export default function makeCreateCounterpartyUsecase(deps: IDependencies) {
  return async (payload: ICounterpartyCreateReq): Promise<ICounterpartyDto> => {
    zodValidationRunner(counterpartyCreateReqValidation, payload);

    const { correlationId, idempotencyKey, actor, accountingEntity } =
      deps.appContext.get(['actor', 'accountingEntity']);

    const creationPayload = counterpartyDtoMapper.fromDto(
      payload,
      accountingEntity.id,
      actor.id
    );
    const creation = deps.counterpartyService.create(creationPayload);
    const [counterparty, events, audit] = creation;

    const history = historyValue.make(audit, actor.id, correlationId);

    await deps.counterpartyRepo.create(counterparty, {
      correlationId,
      history,
    });

    const repoOptions = { correlationId, idempotencyKey };
    const enrichedEvents = eventValue.enrichAll(events, repoOptions);
    await deps.eventBus.publish(enrichedEvents);

    return counterpartyDtoMapper.toDto(counterparty);
  };
}
