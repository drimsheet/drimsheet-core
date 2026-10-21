import IAppContextService from '@shared/contracts/app-context.service.contract';

import IActorService from '@domain/user/types/actor.service.types';

import { INextCurrentReportingPeriodDto } from '@app/accounting/dtos/current-reporting-period/current-reporting-period.dto';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  actorService: IActorService;
  appContext: IAppContextService<IAppContextData>;
  usecase: (accountingPeriod: INextCurrentReportingPeriodDto) => Promise<void>;
}

export default function makeSetCurrentReportingPeriodWorker(
  deps: IDependencies
) {
  return async (payload: INextCurrentReportingPeriodDto): Promise<void> => {
    const { correlationId } = deps.appContext.get();
    const actor = await deps.actorService.resolveByUsername('drimsheet-core', {
      correlationId,
    });

    deps.appContext.set({ actor });

    await deps.usecase(payload);
  };
}
