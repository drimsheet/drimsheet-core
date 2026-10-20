import makeExchangeRateIngestionWorker from '@app/money/workers/exchange-rate-ingestion.worker';

import { actorService } from '@infra/ioc/services/user';
import { ingestExchangeRateUseCase } from '@infra/ioc/usecases/money';
import logger from '@infra/observability/logger';
import backgroundJobCheckpointRepo from '@infra/persistence/repos/background-job/background-job-checkpoint.repo.impl';
import appContext from '@infra/services/app-context.service';

export const exchangeRateIngestionWorker = makeExchangeRateIngestionWorker({
  actorService,
  appContext,
  logger,
  usecase: ingestExchangeRateUseCase,
  backgroundJobCheckpointRepo,
});
