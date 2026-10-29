/**
 * SUMMARY
 * Creates the accounting configuration linking a fiscal year, accounting
 * calendar, and accounting standard for the selected entity. Validates their
 * compatibility and context uniqueness, saves the context with audit history,
 * publishes events, and returns it. Does not select or create a reporting
 * context.
 *
 * WHEN TO USE
 * Use after the year and accounting interval exist.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import IAccountingContextRepo from '@domain/accounting/repos/accounting-context.repo';
import IAccountingIntervalRepo from '@domain/accounting/repos/accounting-interval.repo';
import IFiscalYearRepo from '@domain/accounting/repos/fiscal-year.repo';
import IAccountingContextService from '@domain/accounting/types/accounting-context.service.types';
import { IAccountingContext } from '@domain/accounting/types/context.types';

import { IAccountingContextCreationReq } from '@app/accounting/dtos/accounting-context/accounting-context.dto';
import { accountingContextCreationDtoSchema } from '@app/accounting/dtos/accounting-context/accounting-context.dto.validation';
import accountingAppError from '@app/accounting/errors/accounting.error';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  accountingContextService: IAccountingContextService;
  fiscalYearRepo: IFiscalYearRepo;
  accountingIntervalRepo: IAccountingIntervalRepo;
  accountingContextRepo: IAccountingContextRepo;
  eventBus: IEventBus;
}

export default function makeCreateAccountingContextUsecase(
  deps: IDependencies
) {
  return async (
    payload: IAccountingContextCreationReq
  ): Promise<IAccountingContext> => {
    zodValidationRunner(accountingContextCreationDtoSchema, payload);

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

    const accountingInterval = await deps.accountingIntervalRepo.findById(
      accountingEntity.id,
      payload.accountingIntervalId as TEntityId,
      repoOptions
    );

    if (!accountingInterval) {
      throw new accountingAppError.AccountingIntervalNotFound();
    }

    const creationInput = {
      accountingEntity,
      fiscalYear,
      accountingInterval,
      accountingStandardCode: payload.accountingStandardCode,
      name: payload.name,
      description: payload.description,
      createdBy: actor.id,
    };

    const [context, events, audit] = await deps.accountingContextService.create(
      creationInput,
      repoOptions
    );

    const history = historyValue.make(audit, actor.id, correlationId);

    await deps.accountingContextRepo.create(context, {
      ...repoOptions,
      history,
    });

    await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));

    return context;
  };
}
