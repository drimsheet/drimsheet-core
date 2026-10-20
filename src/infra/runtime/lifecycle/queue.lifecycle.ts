import queueResources from '@infra/messaging/queues/queue-resources';

let shutdownPromise: Promise<void> | undefined;

function shutdown(): Promise<void> {
  shutdownPromise ??= queueResources.close();
  return shutdownPromise;
}

const queueLifecycle = Object.freeze({ shutdown });

export default queueLifecycle;
