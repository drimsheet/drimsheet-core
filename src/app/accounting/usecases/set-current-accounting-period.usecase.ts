/**
 * SUMMARY
 * Refreshes an accounting calendar's current period using today's date. Reloads
 * the interval and derives the current period rather than blindly advancing one
 * period. Saves changes with audit history and publishes events; an unchanged
 * period produces no writes, audit, or events. Requires an actor, rejects a
 * missing interval, and returns no value.
 *
 * WHEN TO USE
 * Use in background processing with a discovered entity and interval
 * descriptor.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import accountingIntervalEntity from '@domain/accounting/entities/accounting-interval.entity';
import IAccountingIntervalRepo from '@domain/accounting/repos/accounting-interval.repo';

import { INextCurrentAccountingPeriodDto } from '@app/accounting/dtos/current-accounting-period/current-accounting-period.dto';
import { nextCurrentAccountingPeriodDtoSchema } from '@app/accounting/dtos/current-accounting-period/current-accounting-period.dto.validation';
import accountingAppError from '@app/accounting/errors/accounting.error';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  accountingIntervalRepo: IAccountingIntervalRepo;
  eventBus: IEventBus;
}

export default function makeSetCurrentAccountingPeriodUsecase(
  deps: IDependencies
) {
  return async (payload: INextCurrentAccountingPeriodDto): Promise<void> => {
    zodValidationRunner(nextCurrentAccountingPeriodDtoSchema, payload);
    const { actor, correlationId } = deps.appContext.get(['actor']);

    const repoOptions = { correlationId };

    const currentInterval = await deps.accountingIntervalRepo.findById(
      payload.accountingEntityId,
      payload.accountingIntervalId,
      repoOptions
    );

    if (!currentInterval) {
      throw new accountingAppError.AccountingIntervalNotFound();
    }

    const [interval, events, audit] =
      accountingIntervalEntity.updateCurrentPeriod(currentInterval);

    if (!audit) {
      return;
    }

    const history = historyValue.make(audit, actor.id, correlationId);
    await deps.accountingIntervalRepo.update(interval, {
      ...repoOptions,
      history,
    });

    await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));
  };
}
