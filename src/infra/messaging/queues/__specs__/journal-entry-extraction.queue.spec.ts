import { Queue } from 'bullmq';

import mockQueueMetrics from '@shared/contracts/__mocks__/queue-metrics.mock';
import mockReporter from '@shared/contracts/__mocks__/reporter.mock';
import mockTracer from '@shared/contracts/__mocks__/tracer.mock';

import { JOURNAL_ENTRY_EXTRACTION_QUEUE_NAME } from '@app/journal-entry/contracts/queues/journal-entry-extraction-queue.contract';
import { IJournalEntryExtractionDto } from '@app/journal-entry/dtos/journal-entry-extraction/journal-entry-extraction.dto';

import makeJournalEntryExtractionQueue from '@infra/messaging/queues/journal-entry-extraction.queue';
import queueLifecycle from '@infra/runtime/lifecycle/queue.lifecycle';

const mockQueueAdd = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn(() => ({ add: mockQueueAdd })),
}));

jest.mock('@infra/config/redis.config', () => ({
  getQueueConnection: jest.fn(() => ({ host: 'mock-redis' })),
}));

jest.mock('@infra/runtime/lifecycle/queue.lifecycle', () => ({
  __esModule: true,
  default: { register: jest.fn() },
}));

describe('makeJournalEntryExtractionQueue', () => {
  const payload: IJournalEntryExtractionDto = {
    accountId: '123e4567-e89b-12d3-a456-426614174002',
    actorId: '123e4567-e89b-12d3-a456-426614174003',
    accountingEntityId: '123e4567-e89b-12d3-a456-426614174004',
    value: {
      url: 'https://example.com/receipt.png',
      name: 'receipt.png',
      type: 'image/png',
      size: 100,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueueAdd.mockReset();
    mockTracer.getPropagationCarrier.mockReturnValue({
      baggage: 'sentry-environment=test',
    });
  });

  it('lazily creates and reuses a queue registered for shutdown', async () => {
    const queue = makeJournalEntryExtractionQueue(
      mockReporter,
      mockQueueMetrics,
      mockTracer
    );
    expect(Queue).not.toHaveBeenCalled();

    await queue.add('producer-correlation', payload);
    await queue.add('producer-correlation', payload);

    expect(Queue).toHaveBeenCalledTimes(1);
    expect(Queue).toHaveBeenCalledWith(JOURNAL_ENTRY_EXTRACTION_QUEUE_NAME, {
      connection: { host: 'mock-redis' },
    });
    expect(queueLifecycle.register).toHaveBeenCalledWith(
      jest.mocked(Queue).mock.results[0].value
    );
    expect(mockQueueAdd).toHaveBeenCalledWith(
      JOURNAL_ENTRY_EXTRACTION_QUEUE_NAME,
      {
        __observabilityEnvelopeVersion: 1,
        correlationId: 'producer-correlation',
        payload,
        trace: { baggage: 'sentry-environment=test' },
      },
      {
        removeOnComplete: true,
        removeOnFail: 20,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
      }
    );
    expect(mockQueueMetrics.recordEnqueueSucceeded).toHaveBeenCalledWith({
      queueName: JOURNAL_ENTRY_EXTRACTION_QUEUE_NAME,
      transport: 'bullmq',
    });
    expect(mockQueueMetrics.recordEnqueueFailed).not.toHaveBeenCalled();
  });

  it('reports enqueue failures and rejects', async () => {
    const failure = new Error('queue unavailable');
    mockQueueAdd.mockRejectedValue(failure);
    const queue = makeJournalEntryExtractionQueue(
      mockReporter,
      mockQueueMetrics,
      mockTracer
    );

    await expect(queue.add('producer-correlation', payload)).rejects.toBe(
      failure
    );

    expect(mockQueueMetrics.recordEnqueueFailed).toHaveBeenCalledWith({
      queueName: JOURNAL_ENTRY_EXTRACTION_QUEUE_NAME,
      transport: 'bullmq',
    });
    expect(mockReporter.report).toHaveBeenCalledWith(
      'queue.job.enqueue_failed',
      failure,
      { queue: JOURNAL_ENTRY_EXTRACTION_QUEUE_NAME, transport: 'bullmq' }
    );
    expect(mockQueueMetrics.recordEnqueueSucceeded).not.toHaveBeenCalled();
  });
});
