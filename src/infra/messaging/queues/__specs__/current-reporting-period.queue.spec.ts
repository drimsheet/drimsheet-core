import mockTracer from '@shared/contracts/__mocks__/tracer.mock';
import generateUUID from '@shared/utils/uuid-generator';

import { CURRENT_REPORTING_PERIOD_QUEUE_NAME } from '@app/accounting/contracts/current-reporting-period-queue.contract';
import { INextCurrentReportingPeriodDto } from '@app/accounting/dtos/current-reporting-period/current-reporting-period.dto';

type TQueueFactory =
  (typeof import('@infra/messaging/queues/current-reporting-period.queue'))['default'];

const mockQueueAdd = jest.fn();
const mockQueueConstructor = jest.fn();
jest.mock('bullmq', () => ({
  Queue: mockQueueConstructor,
}));
jest.mock('@infra/config/redis.config', () => ({
  getQueueConnection: jest.fn(() => ({ host: 'mock-redis' })),
}));

describe('current reporting period queue', () => {
  const payload: INextCurrentReportingPeriodDto = {
    accountingEntityId: generateUUID(),
    reportingIntervalId: generateUUID(),
  };
  let queue: ReturnType<TQueueFactory>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockQueueAdd.mockReset().mockResolvedValue(undefined);
    mockQueueConstructor.mockImplementation(() => ({ add: mockQueueAdd }));
    await jest.isolateModulesAsync(async () => {
      const makeQueue = (
        await import('@infra/messaging/queues/current-reporting-period.queue')
      ).default;
      queue = makeQueue(mockTracer);
    });
    mockTracer.getPropagationCarrier.mockReturnValue({
      sentryTrace: 'trace-carrier',
    });
  });

  it('enqueues the transition and trace metadata using the existing retry options', async () => {
    await queue.add('producer-correlation', payload);

    expect(mockQueueAdd).toHaveBeenCalledWith(
      CURRENT_REPORTING_PERIOD_QUEUE_NAME,
      {
        __observabilityEnvelopeVersion: 1,
        correlationId: 'producer-correlation',
        payload,
        trace: { sentryTrace: 'trace-carrier' },
      },
      {
        jobId: `${CURRENT_REPORTING_PERIOD_QUEUE_NAME}_${payload.accountingEntityId}_${payload.reportingIntervalId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: true,
      }
    );
  });

  it('reuses the queue and interval job ID across scheduler runs', async () => {
    await queue.add('producer-correlation', payload);
    await queue.add('producer-correlation', payload);
    expect(mockQueueConstructor).toHaveBeenCalledTimes(1);
    expect(mockQueueAdd.mock.calls[0][2].jobId).toBe(
      mockQueueAdd.mock.calls[1][2].jobId
    );

    await queue.add('producer-correlation', {
      ...payload,
      reportingIntervalId: generateUUID(),
    });
    expect(mockQueueAdd.mock.calls[2][2].jobId).not.toBe(
      mockQueueAdd.mock.calls[0][2].jobId
    );

    await queue.add('producer-correlation', {
      ...payload,
      accountingEntityId: generateUUID(),
    });
    expect(mockQueueAdd.mock.calls[3][2].jobId).not.toBe(
      mockQueueAdd.mock.calls[0][2].jobId
    );
  });

  it('rejects enqueue failures so the scheduler can report them', async () => {
    const failure = new Error('Queue unavailable');
    mockQueueAdd.mockRejectedValue(failure);
    await expect(queue.add('producer-correlation', payload)).rejects.toBe(
      failure
    );
  });
});
