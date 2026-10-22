import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import reportingIntervalEntity from '@domain/accounting/entities/reporting-interval.entity';
import IReportingIntervalRepo from '@domain/accounting/repos/reporting-interval.repo';

import { INextCurrentReportingPeriodDto } from '@app/accounting/dtos/current-reporting-period/current-reporting-period.dto';
import { nextCurrentReportingPeriodDtoSchema } from '@app/accounting/dtos/current-reporting-period/current-reporting-period.dto.validation';
import accountingAppError from '@app/accounting/errors/accounting.error';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  reportingIntervalRepo: IReportingIntervalRepo;
  eventBus: IEventBus;
}

export default function makeSetCurrentReportingPeriodUsecase(
  deps: IDependencies
) {
  return async (payload: INextCurrentReportingPeriodDto): Promise<void> => {
    zodValidationRunner(nextCurrentReportingPeriodDtoSchema, payload);
    const { actor, correlationId } = deps.appContext.get(['actor']);

    const repoOptions = { correlationId };

    const currentInterval = await deps.reportingIntervalRepo.findById(
      payload.accountingEntityId,
      payload.reportingIntervalId,
      repoOptions
    );

    if (!currentInterval) {
      throw new accountingAppError.ReportingIntervalNotFound();
    }

    const [interval, events, audit] =
      reportingIntervalEntity.updateCurrentPeriod(currentInterval);

    if (!audit) {
      return;
    }

    const history = historyValue.make(audit, actor.id, correlationId);
    await deps.reportingIntervalRepo.update(interval, {
      ...repoOptions,
      history,
    });

    await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));
  };
}
