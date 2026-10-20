import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import IReportingContextRepo from '@domain/accounting/repos/reporting-context.repo';
import IReportingContextService from '@domain/accounting/types/reporting-context.service.types';

import { INextCurrentReportingPeriodDto } from '@app/accounting/dtos/current-reporting-period/current-reporting-period.dto';
import { nextCurrentReportingPeriodDtoSchema } from '@app/accounting/dtos/current-reporting-period/current-reporting-period.dto.validation';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  reportingContextService: IReportingContextService;
  reportingContextRepo: IReportingContextRepo;
  eventBus: IEventBus;
}

export default function makeSetCurrentReportingPeriodUsecase(
  deps: IDependencies
) {
  return async (payload: INextCurrentReportingPeriodDto): Promise<void> => {
    zodValidationRunner(nextCurrentReportingPeriodDtoSchema, payload);
    const { actor, correlationId } = deps.appContext.get(['actor']);

    const repoOptions = { correlationId };

    const updateInput = {
      reportingContextId: payload.reportingContextId,
      previousState: {
        currentReportingPeriod: payload.currentPeriodId,
        nextReportingPeriod: payload.nextPeriodId,
      },
    };

    const [context, events, audit] =
      await deps.reportingContextService.updateCurrentReportingPeriod(
        updateInput,
        repoOptions
      );

    if (!audit) {
      return;
    }

    const history = historyValue.make(audit, actor.id, correlationId);
    await deps.reportingContextRepo.update(context, {
      ...repoOptions,
      history,
    });

    await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));
  };
}
