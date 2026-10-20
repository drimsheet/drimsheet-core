import { Worker } from 'bullmq';

import mockQueueMetrics from '@shared/contracts/__mocks__/queue-metrics.mock';
import mockTracer from '@shared/contracts/__mocks__/tracer.mock';

import { CURRENT_ACCOUNTING_PERIOD_QUEUE_NAME } from '@app/accounting/contracts/current-accounting-period-queue.contract';
import { CURRENT_REPORTING_PERIOD_QUEUE_NAME } from '@app/accounting/contracts/current-reporting-period-queue.contract';
import { LEDGER_BALANCE_ADJUSTMENT_QUEUE_NAME } from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
import { TRANSACTIONAL_EMAIL_QUEUE_NAME } from '@app/notification/contracts/transactional-email-queue.contract';

import { registerBullMQWorker } from '@infra/config/bullmq.config';
import {
  setCurrentAccountingPeriodWorker,
  setCurrentReportingPeriodWorker,
} from '@infra/ioc/workers/accounting';
import { ledgerAccountBalanceAdjustmentWorker } from '@infra/ioc/workers/ledger';
import { transactionalEmailWorker } from '@infra/ioc/workers/notification';
import workerRegistrations from '@infra/runtime/bootstrap/queue-workers.bootstrap';
import queueLifecycle from '@infra/runtime/lifecycle/queue.lifecycle';
import appContext from '@infra/services/app-context.service';

jest.mock('bullmq', () => ({ Worker: jest.fn() }));

jest.mock('@infra/config/bullmq.config', () => ({
  registerBullMQWorker: jest.fn(),
}));

jest.mock('@infra/ioc/workers/accounting', () => ({
  setCurrentAccountingPeriodWorker: jest.fn(),
  setCurrentReportingPeriodWorker: jest.fn(),
}));

jest.mock('@infra/runtime/lifecycle/queue.lifecycle', () => ({
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

describe('queue worker bootstrap', () => {
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

    expect(registerBullMQWorker).toHaveBeenCalledTimes(4);
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
    expect(registerBullMQWorker).toHaveBeenNthCalledWith(
      4,
      CURRENT_REPORTING_PERIOD_QUEUE_NAME,
      setCurrentReportingPeriodWorker,
      appContext,
      mockQueueMetrics,
      mockTracer
    );
    expect(jest.mocked(queueLifecycle.registerWorker).mock.calls).toEqual(
      jest
        .mocked(registerBullMQWorker)
        .mock.results.map((result) => [result.value])
    );
  });

  it('does not start workers until their registrations are invoked', () => {
    expect(workerRegistrations).toHaveLength(4);
    expect(Object.isFrozen(workerRegistrations)).toBe(true);
    expect(registerBullMQWorker).not.toHaveBeenCalled();
  });
});
