import { Worker } from 'bullmq';

import mockQueueMetrics from '@shared/contracts/__mocks__/queue-metrics.mock';
import mockTracer from '@shared/contracts/__mocks__/tracer.mock';
import generateUUID from '@shared/utils/uuid-generator';

import { CURRENT_ACCOUNTING_PERIOD_QUEUE_NAME } from '@app/accounting/contracts/current-accounting-period-queue.contract';
import { INextCurrentAccountingPeriodDto } from '@app/accounting/dtos/current-accounting-period/current-accounting-period.dto';

import { registerBullMQWorker } from '@infra/config/bullmq.config';
import { setCurrentAccountingPeriodWorker } from '@infra/ioc/workers/accounting';
import queueResources from '@infra/messaging/queues/queue-resources';
import registerCurrentAccountingPeriodWorker from '@infra/messaging/workers/current-accounting-period.worker';
import appContext from '@infra/services/app-context.service';

jest.mock('bullmq', () => ({ Worker: jest.fn() }));
jest.mock('@infra/config/bullmq.config', () => ({
  registerBullMQWorker: jest.fn(),
}));
jest.mock('@infra/ioc/workers/accounting', () => ({
  setCurrentAccountingPeriodWorker: jest.fn(),
}));
jest.mock('@infra/messaging/queues/queue-resources', () => ({
  __esModule: true,
  default: { registerWorker: jest.fn() },
}));
jest.mock('@infra/observability', () => ({
  __esModule: true,
  default: {
    queueMetrics: jest.requireActual(
      '@shared/contracts/__mocks__/queue-metrics.mock'
    ).default,
    tracer: jest.requireActual('@shared/contracts/__mocks__/tracer.mock')
      .default,
  },
}));

describe('current accounting period worker registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers the processor with context, tracing, metrics and cleanup', () => {
    const worker = new Worker('mock-worker', async () => undefined);
    jest.mocked(registerBullMQWorker).mockReturnValue(worker);

    registerCurrentAccountingPeriodWorker();

    expect(registerBullMQWorker).toHaveBeenCalledWith(
      CURRENT_ACCOUNTING_PERIOD_QUEUE_NAME,
      setCurrentAccountingPeriodWorker,
      appContext,
      expect.any(Function),
      mockQueueMetrics,
      mockTracer
    );
    expect(queueResources.registerWorker).toHaveBeenCalledWith(worker);

    const getInitialStore = jest.mocked(registerBullMQWorker).mock.calls[0][3];
    const payload: INextCurrentAccountingPeriodDto = {
      accountingContextId: generateUUID(),
      fiscalYearId: generateUUID(),
      accountingEntityId: generateUUID(),
      currentPeriodId: generateUUID(),
      nextPeriodId: generateUUID(),
    };
    const firstStore = getInitialStore(payload);
    const secondStore = getInitialStore(payload);

    expect(firstStore).toEqual({
      correlationId: expect.any(String),
      idempotencyKey: '',
    });
    expect(firstStore.correlationId).not.toBe(secondStore.correlationId);
  });
});
