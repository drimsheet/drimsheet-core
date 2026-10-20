import IAppContextService from '@shared/contracts/app-context.service.contract';

import IActorService from '@domain/user/types/actor.service.types';

import { INextCurrentAccountingPeriodDto } from '@app/accounting/dtos/current-accounting-period/current-accounting-period.dto';
import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  actorService: IActorService;
  appContext: IAppContextService<IAppContextData>;
  usecase: (accountingPeriod: INextCurrentAccountingPeriodDto) => Promise<void>;
}

export default function makeSetCurrentAccountingPeriodWorker(
  deps: IDependencies
) {
  return async (payload: INextCurrentAccountingPeriodDto): Promise<void> => {
    const { correlationId } = deps.appContext.get();
    const actor = await deps.actorService.resolveByUsername('drimsheet-core', {
      correlationId,
    });

    deps.appContext.set({ actor });

    await deps.usecase(payload);
  };
}
