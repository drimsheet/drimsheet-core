import mockQueueMetrics from '@shared/contracts/__mocks__/queue-metrics.mock';
import mockReporter from '@shared/contracts/__mocks__/reporter.mock';
import mockTracer from '@shared/contracts/__mocks__/tracer.mock';

import { ITransactionalEmailDto } from '@app/notification/dtos/transactional-email/transactional-email.dto';

import makeTransactionalEmailQueue from '@infra/messaging/queues/transactional-email.queue';

const mockQueueAdd = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn(() => ({ add: mockQueueAdd })),
}));

jest.mock('../../../config/redis.config', () => ({
  getQueueConnection: jest.fn(() => ({ host: 'mock-redis' })),
}));

describe('makeTransactionalEmailQueue', () => {
  const payload: ITransactionalEmailDto = {
    emails: ['recipient@example.com'],
    subject: 'Test email',
    html: '<p>Test</p>',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueueAdd.mockReset();
    mockTracer.getPropagationCarrier.mockReturnValue({
      baggage: 'sentry-environment=test',
    });
  });

  it('records a successful enqueue after BullMQ accepts the job', async () => {
    mockQueueAdd.mockResolvedValue(undefined);
    const queue = makeTransactionalEmailQueue(
      mockReporter,
      mockQueueMetrics,
      mockTracer
    );

    await queue.add('producer-correlation', payload);

    expect(mockQueueMetrics.recordEnqueueSucceeded).toHaveBeenCalledWith({
      queueName: 'transactional-email-queue',
      transport: 'bullmq',
    });
    expect(mockQueueMetrics.recordEnqueueFailed).not.toHaveBeenCalled();
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'transactional-email-queue',
      {
        __observabilityEnvelopeVersion: 1,
        correlationId: 'producer-correlation',
        payload,
        trace: { baggage: 'sentry-environment=test' },
      },
      expect.objectContaining({
        attempts: 3,
        jobId: 'transactional-email-queue_producer-correlation',
      })
    );
  });

  it('reports an enqueue event and preserves rejection semantics', async () => {
    const failure = new Error('queue unavailable');
    mockQueueAdd.mockRejectedValue(failure);
    const queue = makeTransactionalEmailQueue(
      mockReporter,
      mockQueueMetrics,
      mockTracer
    );

    await expect(queue.add('producer-correlation', payload)).rejects.toBe(
      failure
    );

    expect(mockReporter.report).toHaveBeenCalledWith(
      'queue.job.enqueue_failed',
      failure,
      {
        queue: 'transactional-email-queue',
        transport: 'bullmq',
      }
    );
    expect(mockQueueMetrics.recordEnqueueFailed).toHaveBeenCalledWith({
      queueName: 'transactional-email-queue',
      transport: 'bullmq',
    });
    expect(mockQueueMetrics.recordEnqueueSucceeded).not.toHaveBeenCalled();
  });
});
