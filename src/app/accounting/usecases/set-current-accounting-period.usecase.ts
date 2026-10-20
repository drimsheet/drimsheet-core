import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import IAccountingContextRepo from '@domain/accounting/repos/accounting-context.repo';
import IAccountingContextService from '@domain/accounting/types/accounting-context.service.types';

import { INextCurrentAccountingPeriodDto } from '@app/accounting/dtos/current-accounting-period/current-accounting-period.dto';
import { nextCurrentAccountingPeriodDtoSchema } from '@app/accounting/dtos/current-accounting-period/current-accounting-period.dto.validation';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  accountingContextService: IAccountingContextService;
  accountingContextRepo: IAccountingContextRepo;
  eventBus: IEventBus;
}

export default function makeSetCurrentAccountingPeriodUsecase(
  deps: IDependencies
) {
  return async (payload: INextCurrentAccountingPeriodDto): Promise<void> => {
    zodValidationRunner(nextCurrentAccountingPeriodDtoSchema, payload);
    const { actor, correlationId } = deps.appContext.get(['actor']);

    const repoOptions = { correlationId };

    const updateInput = {
      accountingContextId: payload.accountingContextId,
      previousState: {
        currentAccountPeriod: payload.currentPeriodId,
        nextAccountingPeriod: payload.nextPeriodId,
      },
    };

    const [context, events, audit] =
      await deps.accountingContextService.updateCurrentAccountingPeriod(
        updateInput,
        repoOptions
      );

    if (!audit) {
      return;
    }

    const history = historyValue.make(audit, actor.id, correlationId);
    await deps.accountingContextRepo.update(context, {
      ...repoOptions,
      history,
    });

    await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));
  };
}
