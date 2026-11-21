import { MongoClient } from 'mongodb';

import {
  closeMongoConnection,
  getMongoClient,
} from '@infra/config/mongodb.config';

const mockClose = jest.fn();
jest.mock('mongodb', () => ({
  MongoClient: jest.fn(() => ({ close: mockClose })),
}));
jest.mock('@infra/config/vars.config', () => ({
  __esModule: true,
  default: { MONGODB_URL: 'mongodb://mock-mongodb/drimsheet_ai' },
}));

describe('MongoDB connection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClose.mockReset();
    mockClose.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await closeMongoConnection();
  });

  it('does not create a client when shutting down before first use', async () => {
    await closeMongoConnection();

    expect(MongoClient).not.toHaveBeenCalled();
    expect(mockClose).not.toHaveBeenCalled();
  });

  it('reuses one configured client and closes it once', async () => {
    const client = getMongoClient();

    expect(getMongoClient()).toBe(client);
    expect(MongoClient).toHaveBeenCalledTimes(1);
    expect(MongoClient).toHaveBeenCalledWith(
      'mongodb://mock-mongodb/drimsheet_ai'
    );

    await closeMongoConnection();
    await closeMongoConnection();

    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('waits for the client to close', async () => {
    let finish!: () => void;
    mockClose.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );
    getMongoClient();
    const closed = jest.fn();
    const closing = closeMongoConnection().then(closed);
    await Promise.resolve();

    expect(closed).not.toHaveBeenCalled();

    finish();
    await closing;

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('propagates a close failure to the runtime', async () => {
    const failure = new Error('MongoDB close failed');
    mockClose.mockRejectedValueOnce(failure);
    getMongoClient();

    await expect(closeMongoConnection()).rejects.toThrow(failure);
    await closeMongoConnection();

    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
