/**
 * SUMMARY
 * Creates a fiscal year for the selected accounting entity. Enforces fiscal-
 * year rules, including overlap checks, saves the year with audit history,
 * publishes events, and returns it. Does not create intervals or contexts.
 *
 * WHEN TO USE
 * Use to establish the dated year before configuring its accounting and
 * reporting calendars.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import IFiscalYearRepo from '@domain/accounting/repos/fiscal-year.repo';
import IFiscalYearService from '@domain/accounting/types/fiscal-year.service.types';
import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';

import { IFiscalYearCreationReq } from '@app/accounting/dtos/fiscal-year/fiscal-year.dto';
import { fiscalYearCreationDtoSchema } from '@app/accounting/dtos/fiscal-year/fiscal-year.dto.validation';
import accountingAppError from '@app/accounting/errors/accounting.error';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  fiscalYearRepo: IFiscalYearRepo;
  fiscalYearService: IFiscalYearService;
  eventBus: IEventBus;
}

export default function makeCreateFiscalYearUsecase(deps: IDependencies) {
  return async (payload: IFiscalYearCreationReq): Promise<IFiscalYear> => {
    zodValidationRunner(fiscalYearCreationDtoSchema, payload);

    const { actor, accountingEntity, correlationId } = deps.appContext.get([
      'actor',
      'accountingEntity',
    ]);

    const repoOptions = { correlationId };

    if (!accountingEntity) {
      throw new accountingAppError.EntityNotFound();
    }

    const creationInput = {
      accountingEntity,
      createdBy: actor.id,
      name: payload.name,
      startDate: payload.startDate,
      endDate: payload.endDate,
      status: payload.status,
    };

    const [fiscalYear, events, audit] = await deps.fiscalYearService.create(
      creationInput,
      repoOptions
    );

    const history = historyValue.make(audit, actor.id, correlationId);

    await deps.fiscalYearRepo.create(fiscalYear, {
      ...repoOptions,
      history,
    });

    await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));

    return fiscalYear;
  };
}
