import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import IAccountingEntityRepo from '@domain/accounting/repos/accounting-entity.repo';
import IFiscalYearRepo from '@domain/accounting/repos/fiscal-year.repo';
import IAccountingEntityService from '@domain/accounting/types/accounting-entity.service.types';
import IFiscalYearService from '@domain/accounting/types/fiscal-year.service.types';

import {
  IFiscalYearCreationReq,
  IFiscalYearDto,
} from '@app/accounting/dtos/fiscal-year/fiscal-year.dto';
import fiscalYearDtoMapper from '@app/accounting/dtos/fiscal-year/fiscal-year.dto.mapper';
import { fiscalYearCreationDtoSchema } from '@app/accounting/dtos/fiscal-year/fiscal-year.dto.validation';
import accountingAppError from '@app/accounting/errors/accounting.error';
import IAppContext from '@app/context/contracts/app-context.contract';

interface IDependencies {
  appContext: IAppContext;
  accountingEntityRepo: IAccountingEntityRepo;
  accountingEntityService: IAccountingEntityService;
  fiscalYearRepo: IFiscalYearRepo;
  fiscalYearService: IFiscalYearService;
  repoService: IRepoService;
  eventBus: IEventBus;
}

export default function makeCreateFiscalYearUsecase(deps: IDependencies) {
  return async (payload: IFiscalYearCreationReq): Promise<IFiscalYearDto> => {
    zodValidationRunner(fiscalYearCreationDtoSchema, payload);
    const { user, actor, correlationId } = deps.appContext.get([
      'user',
      'actor',
    ]);
    const repoOptions = { correlationId };
    const accountingEntity = await deps.accountingEntityRepo.findById(
      payload.accountingEntityId as TEntityId,
      repoOptions
    );
    if (!accountingEntity) {
      throw new accountingAppError.EntityNotFound();
    }
    deps.accountingEntityService.validateAccess(accountingEntity, user.id);

    const creation = await deps.fiscalYearService.create(
      {
        accountingEntity,
        createdBy: actor.id,
        name: payload.name,
        startDate: payload.startDate,
        endDate: payload.endDate,
        status: payload.status,
      },
      repoOptions
    );
    const [fiscalYear, events, audit] = creation;
    const history = historyValue.make(audit, actor.id, correlationId);

    await deps.repoService.runInTransaction(async (tx) => {
      await deps.fiscalYearRepo.create(fiscalYear, {
        ...repoOptions,
        tx,
        history,
      });
    });
    await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));
    return fiscalYearDtoMapper.toDto(fiscalYear);
  };
}
