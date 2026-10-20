import IORedis from 'ioredis';

import {
  closeRedisConnections,
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
    mockDisconnect.mockReset();
  });

  afterEach(() => {
    closeRedisConnections();
  });

  it('does not open a connection for cleanup before first use', () => {
    closeRedisConnections();
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

    closeRedisConnections();
    closeRedisConnections();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
    expect(getQueueConnection()).not.toBe(connection);
  });

  it('closes every initialized Redis client through messaging cleanup', () => {
    const redis = getRedis();
    const publisher = getRedisPublisher();
    const subscriber = getRedisSubscriber();
    expect(getRedis()).toBe(redis);
    expect(getRedisPublisher()).toBe(publisher);
    expect(getRedisSubscriber()).toBe(subscriber);
    expect(IORedis).toHaveBeenCalledTimes(3);

    closeRedisConnections();
    expect(mockDisconnect).toHaveBeenCalledTimes(3);
    closeRedisConnections();
    expect(mockDisconnect).toHaveBeenCalledTimes(3);
    expect(getRedis()).not.toBe(redis);
    expect(getRedisPublisher()).not.toBe(publisher);
    expect(getRedisSubscriber()).not.toBe(subscriber);
  });

  it('attempts every connection even when a disconnect throws', () => {
    getRedis();
    getRedisPublisher();
    getRedisSubscriber();
    getQueueConnection();
    const failure = new Error('Disconnect failed');
    mockDisconnect.mockImplementationOnce(() => {
      throw failure;
    });

    expect(closeRedisConnections).toThrow(
      new AggregateError([failure], 'Redis shutdown failed')
    );
    expect(mockDisconnect).toHaveBeenCalledTimes(4);
    closeRedisConnections();
    expect(mockDisconnect).toHaveBeenCalledTimes(4);
  });
});
