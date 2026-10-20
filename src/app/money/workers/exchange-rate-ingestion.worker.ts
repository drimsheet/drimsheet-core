import IAppContextService from '@shared/contracts/app-context.service.contract';
import IBackgroundJobCheckpointRepo, {
  EBackgroundJob,
} from '@shared/contracts/background-job-checkpoint.repo';
import ILogger from '@shared/contracts/logger.contract';
import { ELogOutcome } from '@shared/types/observability.types';

import IActorService from '@domain/user/types/actor.service.types';

import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  actorService: IActorService;
  appContext: IAppContextService<IAppContextData>;
  logger: ILogger;
  backgroundJobCheckpointRepo: IBackgroundJobCheckpointRepo;
  usecase: () => Promise<{ processedCount: number }>;
}

export default function makeExchangeRateIngestionWorker(deps: IDependencies) {
  return async () => {
    const { correlationId } = deps.appContext.get();

    const actor = await deps.actorService.resolveByUsername('drimsheet-core', {
      correlationId,
    });

    deps.appContext.set({ actor });

    const summary = await deps.usecase();

    await deps.backgroundJobCheckpointRepo.recordSuccess(
      EBackgroundJob.ExchangeRateIngestion,
      { correlationId }
    );

    deps.logger.info('exchange_rate.ingestion.completed', {
      outcome: ELogOutcome.Success,
      processedCount: summary.processedCount,
    });
  };
}
