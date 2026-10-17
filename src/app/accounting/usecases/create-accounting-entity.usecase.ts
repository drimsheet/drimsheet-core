import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';
import IAccountingEntityService from '@domain/accounting/types/accounting-entity.service.types';

import {
  IAccountingEntityCreationDto,
  IAccountingEntityDto,
} from '@app/accounting/dtos/accounting/accounting.dto';
import accountingEntityDtoMapper from '@app/accounting/dtos/accounting/accounting.dto.mapper';
import { accountingEntityCreationDtoSchema } from '@app/accounting/dtos/accounting/accounting.dto.validation';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  accountingEntityRepo: IAccountingEntityRepo;
  accountingEntityService: IAccountingEntityService;
  repoService: IRepoService;
  eventBus: IEventBus;
}

export default function makeCreateAccountingEntityUsecase(deps: IDependencies) {
  return async (
    payload: IAccountingEntityCreationDto
  ): Promise<IAccountingEntityDto> => {
    zodValidationRunner(accountingEntityCreationDtoSchema, payload);

    const { user, actor, correlationId } = deps.appContext.get([
      'user',
      'actor',
    ]);
    const repoOptions = { correlationId };
    const creation = await deps.accountingEntityService.create(
      {
        name: payload.name,
        type: payload.entityType,
        ownerId: user.id,
        createdBy: actor.id,
        functionalCurrencyCode: payload.functionalCurrencyCode,
        jurisdictionCode: payload.jurisdictionCode,
      },
      repoOptions
    );
    const [accountingEntity, events, audit] = creation;
    const history = historyValue.make(audit, actor.id, correlationId);

    await deps.repoService.runInTransaction(async (tx) => {
      await deps.accountingEntityRepo.create(accountingEntity, {
        ...repoOptions,
        tx,
        history,
      });
    });

    await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));

    return accountingEntityDtoMapper.toDto(accountingEntity);
  };
}
