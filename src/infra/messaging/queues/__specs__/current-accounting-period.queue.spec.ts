import mockTracer from '@shared/contracts/__mocks__/tracer.mock';
import generateUUID from '@shared/utils/uuid-generator';

import { CURRENT_ACCOUNTING_PERIOD_QUEUE_NAME } from '@app/accounting/contracts/current-accounting-period-queue.contract';
import { INextCurrentAccountingPeriodDto } from '@app/accounting/dtos/current-accounting-period/current-accounting-period.dto';

type TQueueFactory =
  (typeof import('@infra/messaging/queues/current-accounting-period.queue'))['default'];

const mockQueueAdd = jest.fn();
const mockQueueConstructor = jest.fn();
jest.mock('bullmq', () => ({
  Queue: mockQueueConstructor,
}));
jest.mock('@infra/config/redis.config', () => ({
  getQueueConnection: jest.fn(() => ({ host: 'mock-redis' })),
}));

describe('current accounting period queue', () => {
  const payload: INextCurrentAccountingPeriodDto = {
    accountingContextId: generateUUID(),
    fiscalYearId: generateUUID(),
    accountingEntityId: generateUUID(),
    currentPeriodId: generateUUID(),
    nextPeriodId: generateUUID(),
  };
  let queue: ReturnType<TQueueFactory>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockQueueAdd.mockReset().mockResolvedValue(undefined);
    mockQueueConstructor.mockImplementation(() => ({ add: mockQueueAdd }));
    await jest.isolateModulesAsync(async () => {
      const makeQueue = (
        await import('@infra/messaging/queues/current-accounting-period.queue')
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
      CURRENT_ACCOUNTING_PERIOD_QUEUE_NAME,
      {
        __observabilityEnvelopeVersion: 1,
        correlationId: 'producer-correlation',
        payload,
        trace: { sentryTrace: 'trace-carrier' },
      },
      {
        jobId: `${CURRENT_ACCOUNTING_PERIOD_QUEUE_NAME}_${payload.accountingContextId}_${payload.accountingEntityId}_${payload.fiscalYearId}_${payload.currentPeriodId}_${payload.nextPeriodId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: true,
      }
    );
  });

  it('reuses the queue and transition job ID across scheduler runs', async () => {
    await queue.add('producer-correlation', payload);
    await queue.add('producer-correlation', payload);
    expect(mockQueueConstructor).toHaveBeenCalledTimes(1);
    expect(mockQueueAdd.mock.calls[0][2].jobId).toBe(
      mockQueueAdd.mock.calls[1][2].jobId
    );

    await queue.add('producer-correlation', {
      ...payload,
      nextPeriodId: generateUUID(),
    });
    expect(mockQueueAdd.mock.calls[2][2].jobId).not.toBe(
      mockQueueAdd.mock.calls[0][2].jobId
    );

    await queue.add('producer-correlation', {
      ...payload,
      accountingContextId: generateUUID(),
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
