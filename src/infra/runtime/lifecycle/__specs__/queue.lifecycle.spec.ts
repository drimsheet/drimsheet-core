import type { Worker } from 'bullmq';

import mockTracer from '@shared/contracts/__mocks__/tracer.mock';
import generateUUID from '@shared/utils/uuid-generator';

import { CURRENT_ACCOUNTING_PERIOD_QUEUE_NAME } from '@app/accounting/contracts/current-accounting-period-queue.contract';
import { INextCurrentAccountingPeriodDto } from '@app/accounting/dtos/current-accounting-period/current-accounting-period.dto';
import { LEDGER_BALANCE_ADJUSTMENT_QUEUE_NAME } from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
import { TRANSACTIONAL_EMAIL_QUEUE_NAME } from '@app/notification/contracts/transactional-email-queue.contract';

const mockQueueConstructor = jest.fn();
const mockQueueClose = jest.fn<Promise<void>, [name: string]>();
const mockQueueAdd = jest.fn();
const mockDisconnect = jest.fn();
const mockGetConnection = jest.fn();

jest.mock('bullmq', () => ({ Queue: mockQueueConstructor }));
jest.mock('@infra/config/redis.config', () => ({
  getQueueConnection: mockGetConnection,
  closeQueueConnection: mockDisconnect,
}));

describe('queue lifecycle', () => {
  const payload: INextCurrentAccountingPeriodDto = {
    accountingContextId: generateUUID(),
    fiscalYearId: generateUUID(),
    accountingEntityId: generateUUID(),
    currentPeriodId: generateUUID(),
    nextPeriodId: generateUUID(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    mockQueueConstructor.mockImplementation((name: string) => ({
      add: mockQueueAdd,
      close: () => mockQueueClose(name),
    }));
    mockQueueClose.mockResolvedValue(undefined);
    mockQueueAdd.mockResolvedValue(undefined);
    mockGetConnection.mockReturnValue({ host: 'mock-redis' });
    mockTracer.getPropagationCarrier.mockReturnValue({});
  });

  it('does not initialize unused queues or open Redis during shutdown', async () => {
    await jest.isolateModulesAsync(async () => {
      await import('@infra/messaging/queues/current-accounting-period.queue');
      await import('@infra/messaging/queues/ledger-account-balance.queue');
      await import('@infra/messaging/queues/transactional-email.queue');
      const lifecycle = (
        await import('@infra/runtime/lifecycle/queue.lifecycle')
      ).default;

      await lifecycle.shutdown();

      expect(mockQueueConstructor).not.toHaveBeenCalled();
      expect(mockGetConnection).not.toHaveBeenCalled();
      expect(mockQueueClose).not.toHaveBeenCalled();
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });
  });

  it('closes all initialized producers once before disconnecting shared Redis', async () => {
    await jest.isolateModulesAsync(async () => {
      const makeAccountingQueue = (
        await import('@infra/messaging/queues/current-accounting-period.queue')
      ).default;
      const { getLedgerAccountBalanceAdjustmentQueue } =
        await import('@infra/messaging/queues/ledger-account-balance.queue');
      const { getTransactionalEmailQueue } =
        await import('@infra/messaging/queues/transactional-email.queue');
      const lifecycle = (
        await import('@infra/runtime/lifecycle/queue.lifecycle')
      ).default;
      const queue = makeAccountingQueue(mockTracer);
      await queue.add(payload);
      await queue.add(payload);
      getLedgerAccountBalanceAdjustmentQueue();
      getLedgerAccountBalanceAdjustmentQueue();
      getTransactionalEmailQueue();
      getTransactionalEmailQueue();
      mockQueueClose.mockImplementation(async () => {
        expect(mockDisconnect).not.toHaveBeenCalled();
      });

      const shuttingDown = lifecycle.shutdown();
      expect(lifecycle.shutdown()).toBe(shuttingDown);
      await shuttingDown;
      await lifecycle.shutdown();

      expect(mockQueueConstructor).toHaveBeenCalledTimes(3);
      expect(mockQueueClose.mock.calls).toEqual([
        [CURRENT_ACCOUNTING_PERIOD_QUEUE_NAME],
        [LEDGER_BALANCE_ADJUSTMENT_QUEUE_NAME],
        [TRANSACTIONAL_EMAIL_QUEUE_NAME],
      ]);
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });
  });

  it('waits for every queue and disconnects even when multiple closes fail', async () => {
    await jest.isolateModulesAsync(async () => {
      const makeAccountingQueue = (
        await import('@infra/messaging/queues/current-accounting-period.queue')
      ).default;
      const { getLedgerAccountBalanceAdjustmentQueue } =
        await import('@infra/messaging/queues/ledger-account-balance.queue');
      const { getTransactionalEmailQueue } =
        await import('@infra/messaging/queues/transactional-email.queue');
      const lifecycle = (
        await import('@infra/runtime/lifecycle/queue.lifecycle')
      ).default;
      await makeAccountingQueue(mockTracer).add(payload);
      getLedgerAccountBalanceAdjustmentQueue();
      getTransactionalEmailQueue();
      const firstFailure = new Error('Accounting queue close failed');
      const secondFailure = new Error('Ledger queue close failed');
      let finish!: () => void;
      mockQueueClose
        .mockImplementationOnce(() => {
          throw firstFailure;
        })
        .mockRejectedValueOnce(secondFailure)
        .mockReturnValueOnce(
          new Promise<void>((resolve) => {
            finish = resolve;
          })
        );

      const shuttingDown = lifecycle.shutdown();
      const rejection = expect(shuttingDown).rejects.toMatchObject({
        message: 'Queue shutdown failed',
        errors: [firstFailure, secondFailure],
      });
      await Promise.resolve();
      expect(mockQueueClose).toHaveBeenCalledTimes(3);
      expect(mockDisconnect).not.toHaveBeenCalled();
      finish();
      await rejection;

      expect(mockDisconnect).toHaveBeenCalledTimes(1);
      expect(lifecycle.shutdown()).toBe(shuttingDown);
    });
  });

  it('propagates shared connection cleanup failures to the runtime', async () => {
    await jest.isolateModulesAsync(async () => {
      const lifecycle = (
        await import('@infra/runtime/lifecycle/queue.lifecycle')
      ).default;
      const failure = new Error('Redis disconnect failed');
      mockDisconnect.mockImplementation(() => {
        throw failure;
      });

      await expect(lifecycle.shutdown()).rejects.toMatchObject({
        errors: [failure],
      });
    });
  });

  it('drains workers before closing producers and the shared connection', async () => {
    await jest.isolateModulesAsync(async () => {
      const resources = (
        await import('@infra/messaging/queues/queue-resources')
      ).default;
      const makeQueue = (
        await import('@infra/messaging/queues/current-accounting-period.queue')
      ).default;
      const lifecycle = (
        await import('@infra/runtime/lifecycle/queue.lifecycle')
      ).default;
      let finish!: () => void;
      const closeWorker = jest.fn(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          })
      );
      const worker = { close: closeWorker } as unknown as Worker;
      resources.registerWorker(worker);
      resources.registerWorker(worker);
      await makeQueue(mockTracer).add(payload);

      const shuttingDown = lifecycle.shutdown();
      await Promise.resolve();
      expect(closeWorker).toHaveBeenCalledTimes(1);
      expect(mockQueueClose).not.toHaveBeenCalled();
      expect(mockDisconnect).not.toHaveBeenCalled();

      finish();
      await shuttingDown;
      expect(mockQueueClose).toHaveBeenCalledTimes(1);
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });
  });

  it('attempts all cleanup when a worker cannot close', async () => {
    await jest.isolateModulesAsync(async () => {
      const resources = (
        await import('@infra/messaging/queues/queue-resources')
      ).default;
      const makeQueue = (
        await import('@infra/messaging/queues/current-accounting-period.queue')
      ).default;
      const lifecycle = (
        await import('@infra/runtime/lifecycle/queue.lifecycle')
      ).default;
      const failure = new Error('Worker close failed');
      const closeWorker = jest.fn().mockRejectedValue(failure);
      resources.registerWorker({ close: closeWorker } as unknown as Worker);
      await makeQueue(mockTracer).add(payload);

      await expect(lifecycle.shutdown()).rejects.toMatchObject({
        errors: [failure],
      });
      expect(mockQueueClose).toHaveBeenCalledTimes(1);
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });
  });
});
