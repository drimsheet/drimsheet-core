import { Worker } from 'bullmq';

import mockQueueMetrics from '@shared/contracts/__mocks__/queue-metrics.mock';
import mockTracer from '@shared/contracts/__mocks__/tracer.mock';

import { CURRENT_ACCOUNTING_PERIOD_QUEUE_NAME } from '@app/accounting/contracts/current-accounting-period-queue.contract';
import { LEDGER_BALANCE_ADJUSTMENT_QUEUE_NAME } from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
import { TRANSACTIONAL_EMAIL_QUEUE_NAME } from '@app/notification/contracts/transactional-email-queue.contract';

import { registerBullMQWorker } from '@infra/config/bullmq.config';
import { setCurrentAccountingPeriodWorker } from '@infra/ioc/workers/accounting';
import { ledgerAccountBalanceAdjustmentWorker } from '@infra/ioc/workers/ledger';
import { transactionalEmailWorker } from '@infra/ioc/workers/notification';
import queueResources from '@infra/messaging/queues/queue-resources';
import workerRegistrations from '@infra/messaging/workers';
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

jest.mock('@infra/ioc/workers/ledger', () => ({
  ledgerAccountBalanceAdjustmentWorker: jest.fn(),
}));

jest.mock('@infra/ioc/workers/notification', () => ({
  transactionalEmailWorker: jest.fn(),
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

describe('worker registrations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(registerBullMQWorker)
      .mockImplementation((name) => new Worker(name, async () => undefined));
  });

  it('registers each worker with its queue and processor', () => {
    for (const registerWorker of workerRegistrations) {
      registerWorker();
    }

    expect(registerBullMQWorker).toHaveBeenCalledTimes(3);
    expect(registerBullMQWorker).toHaveBeenNthCalledWith(
      1,
      TRANSACTIONAL_EMAIL_QUEUE_NAME,
      transactionalEmailWorker,
      appContext,
      mockQueueMetrics,
      mockTracer
    );
    expect(registerBullMQWorker).toHaveBeenNthCalledWith(
      2,
      LEDGER_BALANCE_ADJUSTMENT_QUEUE_NAME,
      ledgerAccountBalanceAdjustmentWorker,
      appContext,
      mockQueueMetrics,
      mockTracer
    );
    expect(registerBullMQWorker).toHaveBeenNthCalledWith(
      3,
      CURRENT_ACCOUNTING_PERIOD_QUEUE_NAME,
      setCurrentAccountingPeriodWorker,
      appContext,
      mockQueueMetrics,
      mockTracer
    );
    expect(jest.mocked(queueResources.registerWorker).mock.calls).toEqual(
      jest
        .mocked(registerBullMQWorker)
        .mock.results.map((result) => [result.value])
    );
  });

  it('does not start workers until their registrations are invoked', () => {
    expect(workerRegistrations).toHaveLength(3);
    expect(Object.isFrozen(workerRegistrations)).toBe(true);
    expect(registerBullMQWorker).not.toHaveBeenCalled();
  });
});
