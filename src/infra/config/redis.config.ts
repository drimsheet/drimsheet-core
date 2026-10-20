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

export function closeQueueConnection(): void {
  queueConnection?.disconnect();
  queueConnection = undefined;
}
