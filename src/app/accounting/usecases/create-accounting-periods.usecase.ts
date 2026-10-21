import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import IAccountingPeriodRepo from '@domain/accounting/repos/accounting-period.repo';
import IFiscalYearRepo from '@domain/accounting/repos/fiscal-year.repo';
import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import { IAccountingPeriod } from '@domain/accounting/types/period.types';

import { IAccountingPeriodsCreationReq } from '@app/accounting/dtos/accounting-period/accounting-period.dto';
import { accountingPeriodsCreationDtoSchema } from '@app/accounting/dtos/accounting-period/accounting-period.dto.validation';
import accountingAppError from '@app/accounting/errors/accounting.error';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  fiscalYearRepo: IFiscalYearRepo;
  accountingPeriodService: IAccountingPeriodService;
  accountingPeriodRepo: IAccountingPeriodRepo;
  eventBus: IEventBus;
}

export default function makeCreateAccountingPeriodsUsecase(
  deps: IDependencies
) {
  return async (
    payload: IAccountingPeriodsCreationReq
  ): Promise<IAccountingPeriod[]> => {
    zodValidationRunner(accountingPeriodsCreationDtoSchema, payload);

    const { accountingEntity, actor, correlationId } = deps.appContext.get([
      'accountingEntity',
      'actor',
    ]);

    const repoOptions = { correlationId };

    const fiscalYear = await deps.fiscalYearRepo.findById(
      accountingEntity.id,
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

    await deps.accountingPeriodRepo.create(periods, {
      ...repoOptions,
      history: histories,
    });

    await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));

    return periods;
  };
}
