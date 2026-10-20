import IORedis from 'ioredis';

import {
  closeQueueConnection,
  getQueueConnection,
  getRedis,
  getRedisPublisher,
  getRedisSubscriber,
} from '@infra/config/redis.config';

const mockDisconnect = jest.fn();
jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn(() => ({ disconnect: mockDisconnect })),
}));
jest.mock('@infra/config/vars.config', () => ({
  __esModule: true,
  default: { REDIS_URL: 'redis://mock-redis' },
}));

describe('Redis connections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    closeQueueConnection();
  });

  it('does not open a connection for cleanup before first use', () => {
    closeQueueConnection();
    expect(IORedis).not.toHaveBeenCalled();
    expect(mockDisconnect).not.toHaveBeenCalled();
  });

  it('reuses the queue connection and releases it for background shutdown', () => {
    const connection = getQueueConnection();
    expect(getQueueConnection()).toBe(connection);
    expect(IORedis).toHaveBeenCalledTimes(1);
    expect(IORedis).toHaveBeenCalledWith('redis://mock-redis', {
      maxRetriesPerRequest: null,
    });

    closeQueueConnection();
    closeQueueConnection();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
    expect(getQueueConnection()).not.toBe(connection);
  });

  it('leaves other Redis clients independent of queue cleanup', () => {
    const redis = getRedis();
    const publisher = getRedisPublisher();
    const subscriber = getRedisSubscriber();
    expect(getRedis()).toBe(redis);
    expect(getRedisPublisher()).toBe(publisher);
    expect(getRedisSubscriber()).toBe(subscriber);
    expect(IORedis).toHaveBeenCalledTimes(3);

    closeQueueConnection();
    expect(mockDisconnect).not.toHaveBeenCalled();
  });
});
