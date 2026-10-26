/**
 * SUMMARY
 * Creates an accounting entity owned by the signed-in user. Enforces entity
 * creation rules, saves the entity with audit history, publishes its events,
 * and returns it. Fiscal years, intervals, contexts, ledger setup, and active
 * selection are separate operations.
 *
 * WHEN TO USE
 * Use to start a new set of books with a jurisdiction and functional currency.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';
import IAccountingEntityService from '@domain/accounting/types/accounting-entity.service.types';
import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';

import { IAccountingEntityCreationDto } from '@app/accounting/dtos/accounting/accounting.dto';
import { accountingEntityCreationDtoSchema } from '@app/accounting/dtos/accounting/accounting.dto.validation';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  accountingEntityRepo: IAccountingEntityRepo;
  accountingEntityService: IAccountingEntityService;
  eventBus: IEventBus;
}

export default function makeCreateAccountingEntityUsecase(deps: IDependencies) {
  return async (
    payload: IAccountingEntityCreationDto
  ): Promise<IAccountingEntity> => {
    zodValidationRunner(accountingEntityCreationDtoSchema, payload);

    const { user, actor, correlationId } = deps.appContext.get([
      'user',
      'actor',
    ]);
    const repoOptions = { correlationId };

    const creationInput = {
      name: payload.name,
      type: payload.entityType,
      ownerId: user.id,
      createdBy: actor.id,
      functionalCurrencyCode: payload.functionalCurrencyCode,
      jurisdictionCode: payload.jurisdictionCode,
    };

    const [accountingEntity, events, audit] =
      await deps.accountingEntityService.create(creationInput, repoOptions);

    const history = historyValue.make(audit, actor.id, correlationId);

    await deps.accountingEntityRepo.create(accountingEntity, {
      ...repoOptions,
      history,
    });

    await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));

    return accountingEntity;
  };
}
