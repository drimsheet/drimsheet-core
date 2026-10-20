import mockQueueMetrics from '@shared/contracts/__mocks__/queue-metrics.mock';
import mockReporter from '@shared/contracts/__mocks__/reporter.mock';
import mockTracer from '@shared/contracts/__mocks__/tracer.mock';
import generateUUID from '@shared/utils/uuid-generator';

import { ILedgerAccountBalanceAdjustmentDto } from '@app/ledger/dtos/ledger-account-balance-adjustment/ledger-account-balance-adjustment.dto';

import makeLedgerAccountBalanceAdjustmentQueue from '@infra/messaging/queues/ledger-account-balance.queue';

const mockQueueAdd = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn(() => ({ add: mockQueueAdd })),
}));

jest.mock('../../../config/redis.config', () => ({
  getQueueConnection: jest.fn(() => ({ host: 'mock-redis' })),
}));

describe('makeLedgerAccountBalanceAdjustmentQueue', () => {
  const payload: ILedgerAccountBalanceAdjustmentDto = {
    journalEntryId: generateUUID(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueueAdd.mockReset();
    mockTracer.getPropagationCarrier.mockReturnValue({
      sentryTrace: `${'a'.repeat(32)}-${'b'.repeat(16)}-1`,
    });
  });

  it('records a successful enqueue after BullMQ accepts the job', async () => {
    mockQueueAdd.mockResolvedValue(undefined);
    const queue = makeLedgerAccountBalanceAdjustmentQueue(
      mockReporter,
      mockQueueMetrics,
      mockTracer
    );

    await queue.add('producer-correlation', payload);

    expect(mockQueueMetrics.recordEnqueueSucceeded).toHaveBeenCalledWith({
      queueName: 'ledger-account-balance-adjustment-queue',
      transport: 'bullmq',
    });
    expect(mockQueueMetrics.recordEnqueueFailed).not.toHaveBeenCalled();
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'ledger-account-balance-adjustment-queue',
      {
        __observabilityEnvelopeVersion: 1,
        correlationId: 'producer-correlation',
        payload,
        trace: {
          sentryTrace: `${'a'.repeat(32)}-${'b'.repeat(16)}-1`,
        },
      },
      expect.objectContaining({
        attempts: 3,
        jobId: `ledger-account-balance-adjustment-queue_${payload.journalEntryId}`,
        removeOnFail: true,
      })
    );
  });

  it('reports an enqueue event and preserves best-effort failure semantics', async () => {
    const failure = new Error('queue unavailable');
    mockQueueAdd.mockRejectedValue(failure);
    const queue = makeLedgerAccountBalanceAdjustmentQueue(
      mockReporter,
      mockQueueMetrics,
      mockTracer
    );

    await expect(
      queue.add('producer-correlation', payload)
    ).resolves.toBeUndefined();

    expect(mockReporter.report).toHaveBeenCalledWith(
      'queue.job.enqueue_failed',
      failure,
      {
        queue: 'ledger-account-balance-adjustment-queue',
        transport: 'bullmq',
      }
    );
    expect(mockQueueMetrics.recordEnqueueFailed).toHaveBeenCalledWith({
      queueName: 'ledger-account-balance-adjustment-queue',
      transport: 'bullmq',
    });
    expect(mockQueueMetrics.recordEnqueueSucceeded).not.toHaveBeenCalled();
  });
});
