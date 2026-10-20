import type { Queue, Worker } from 'bullmq';

import { closeQueueConnection } from '@infra/config/redis.config';

const initializedQueues = new Set<Queue>();
const initializedWorkers = new Set<Worker>();

function register(queue: Queue): void {
  initializedQueues.add(queue);
}

function registerWorker(worker: Worker): void {
  initializedWorkers.add(worker);
}

/**
 * Drains workers, then closes producers before releasing the shared connection.
 * Reports failures to the runtime after all cleanup has been attempted.
 */
async function closeQueues(): Promise<void> {
  const workerResults = await Promise.allSettled(
    [...initializedWorkers].map(async (worker) => {
      await worker.close();
    })
  );
  initializedWorkers.clear();

  const queueResults = await Promise.allSettled(
    [...initializedQueues].map(async (queue) => {
      await queue.close();
    })
  );
  initializedQueues.clear();

  const failures: unknown[] = [];
  for (const result of [...workerResults, ...queueResults]) {
    if (result.status === 'rejected') {
      failures.push(result.reason);
    }
  }

  try {
    closeQueueConnection();
  } catch (error) {
    failures.push(error);
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, 'Queue shutdown failed');
  }
}

const queueResources = Object.freeze({
  register,
  registerWorker,
  close: closeQueues,
});

export default queueResources;
