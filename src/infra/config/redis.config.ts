import IORedis from 'ioredis';

import vars from './vars.config';

let redis: IORedis | undefined;
let redisPub: IORedis | undefined;
let redisSub: IORedis | undefined;
let queueConnection: IORedis | undefined;

export function getRedis(): IORedis {
  redis ??= new IORedis(vars.REDIS_URL);
  return redis;
}

export function getRedisPublisher(): IORedis {
  redisPub ??= new IORedis(vars.REDIS_URL);
  return redisPub;
}

export function getRedisSubscriber(): IORedis {
  redisSub ??= new IORedis(vars.REDIS_URL);
  return redisSub;
}

export function getQueueConnection(): IORedis {
  queueConnection ??= new IORedis(vars.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
  return queueConnection;
}

/** Attempt every initialized client disconnect before reporting failures. */
export function closeRedisConnections(): void {
  const connections = [redis, redisPub, redisSub, queueConnection];
  redis = undefined;
  redisPub = undefined;
  redisSub = undefined;
  queueConnection = undefined;

  const failures: unknown[] = [];
  for (const connection of connections) {
    try {
      connection?.disconnect();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, 'Redis shutdown failed');
  }
}
