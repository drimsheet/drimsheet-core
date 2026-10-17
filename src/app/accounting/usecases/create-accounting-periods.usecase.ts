import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import IAccountingPeriodRepo from '@domain/accounting/repos/accounting-period.repo';
import IFiscalYearRepo from '@domain/accounting/repos/fiscal-year.repo';
import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';

import {
  IAccountingPeriodDto,
  IAccountingPeriodsCreationReq,
} from '@app/accounting/dtos/accounting-period/accounting-period.dto';
import accountingPeriodDtoMapper from '@app/accounting/dtos/accounting-period/accounting-period.dto.mapper';
import { accountingPeriodsCreationDtoSchema } from '@app/accounting/dtos/accounting-period/accounting-period.dto.validation';
import accountingAppError from '@app/accounting/errors/accounting.error';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  fiscalYearRepo: IFiscalYearRepo;
  accountingPeriodService: IAccountingPeriodService;
  accountingPeriodRepo: IAccountingPeriodRepo;
  repoService: IRepoService;
  eventBus: IEventBus;
}

export default function makeCreateAccountingPeriodsUsecase(
  deps: IDependencies
) {
  return async (
    payload: IAccountingPeriodsCreationReq
  ): Promise<IAccountingPeriodDto[]> => {
    zodValidationRunner(accountingPeriodsCreationDtoSchema, payload);

    const { accountingEntity, actor, correlationId } = deps.appContext.get([
      'accountingEntity',
      'actor',
    ]);

    const repoOptions = { correlationId };

    const fiscalYear = await deps.fiscalYearRepo.findById(
      payload.fiscalYearId as TEntityId,
      repoOptions
    );
    if (!fiscalYear) {
      throw new accountingAppError.FiscalYearNotFound();
    }

    const creationInput = {
      accountingEntityId: accountingEntity.id,
      fiscalYear,
      createdBy: actor.id,
      unit: payload.unit,
      count: payload.count,
    };

    const creations = await deps.accountingPeriodService.generate(
      creationInput,
      repoOptions
    );

    const periods = creations.map(([period]) => period);

    const histories = creations.map(([, , audit]) =>
      historyValue.make(audit, actor.id, correlationId)
    );
    const events = creations.flatMap(([, periodEvents]) => periodEvents);

    await deps.repoService.runInTransaction(async (tx) => {
      await deps.accountingPeriodRepo.create(periods, {
        ...repoOptions,
        tx,
        history: histories,
      });
    });

    // TODO (ENG-218): Schedule background transitions of the current accounting period.
    // https://drimsheet-app.atlassian.net/browse/ENG-218

    await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));

    return periods.map(accountingPeriodDtoMapper.toDto);
  };
}
