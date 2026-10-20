import mockBackgroundJobCheckpointRepo from '@shared/contracts/__mocks__/background-job-checkpoint.repo.mock';
import mockLogger from '@shared/contracts/__mocks__/logger.mock';
import { EBackgroundJob } from '@shared/contracts/background-job-checkpoint.repo';

import actorEntity from '@domain/user/entities/actor.entity';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import makeExchangeRateIngestionWorker from '@app/money/workers/exchange-rate-ingestion.worker';
import { mockActorService } from '@app/user/contracts/__mocks__/actor.services.mock';

describe('exchange-rate ingestion worker', () => {
  const correlationId = '019cde0f-5b78-775a-bf29-8f02a947760a';
  const [actor] = actorEntity.makeSystem(actorEntity.makeMigration()[0].id);
  const usecase = jest.fn();
  const worker = makeExchangeRateIngestionWorker({
    actorService: mockActorService,
    appContext: mockAppContext,
    logger: mockLogger,
    usecase,
    backgroundJobCheckpointRepo: mockBackgroundJobCheckpointRepo,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({ correlationId, idempotencyKey: '' });
    mockActorService.resolveByUsername.mockResolvedValue(actor);
    usecase.mockResolvedValue({ processedCount: 2 });
  });

  it('ingests as the system actor and checkpoints the successful run', async () => {
    usecase.mockImplementation(async () => {
      expect(mockAppContext.set).toHaveBeenCalledWith({ actor });
      return { processedCount: 2 };
    });
    await worker();
    expect(mockActorService.resolveByUsername).toHaveBeenCalledWith(
      'drimsheet-core',
      { correlationId }
    );
    expect(
      mockBackgroundJobCheckpointRepo.getLastSucceededAt
    ).not.toHaveBeenCalled();
    expect(usecase).toHaveBeenCalledTimes(1);
    expect(mockBackgroundJobCheckpointRepo.recordSuccess).toHaveBeenCalledWith(
      EBackgroundJob.ExchangeRateIngestion,
      { correlationId }
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'exchange_rate.ingestion.completed',
      {
        outcome: 'success',
        processedCount: 2,
      }
    );
  });

  it('does not ingest or report success when actor resolution fails', async () => {
    const failure = new Error('Actor unavailable');
    mockActorService.resolveByUsername.mockRejectedValue(failure);
    await expect(worker()).rejects.toBe(failure);
    expect(usecase).not.toHaveBeenCalled();
    expect(
      mockBackgroundJobCheckpointRepo.recordSuccess
    ).not.toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  it('propagates ingestion failures to the scheduled job without recording success', async () => {
    const failure = new Error('Ingestion failed');
    usecase.mockRejectedValue(failure);
    await expect(worker()).rejects.toBe(failure);
    expect(
      mockBackgroundJobCheckpointRepo.recordSuccess
    ).not.toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  it('records completion only after an empty ingestion has resolved', async () => {
    let finishIngestion!: (summary: { processedCount: number }) => void;
    usecase.mockReturnValue(
      new Promise((resolve) => {
        finishIngestion = resolve;
      })
    );
    const running = worker();
    await Promise.resolve();
    expect(usecase).toHaveBeenCalled();
    expect(
      mockBackgroundJobCheckpointRepo.recordSuccess
    ).not.toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalled();
    finishIngestion({ processedCount: 0 });
    await running;
    expect(mockBackgroundJobCheckpointRepo.recordSuccess).toHaveBeenCalledWith(
      EBackgroundJob.ExchangeRateIngestion,
      { correlationId }
    );
  });

  it('propagates checkpoint failures without reporting successful completion', async () => {
    const failure = new Error('Checkpoint write failed');
    mockBackgroundJobCheckpointRepo.recordSuccess.mockRejectedValue(failure);
    await expect(worker()).rejects.toBe(failure);
    expect(mockLogger.info).not.toHaveBeenCalled();
  });
});
