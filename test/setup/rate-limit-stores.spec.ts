import rateLimit, { MemoryStore } from 'express-rate-limit';

const stores: MemoryStore[] = [];

beforeAll(() => {
  jest.useFakeTimers();
});

// The setup file's root afterAll runs first. Check the actual suite teardown,
// including timers created after mock restoration and repeated initialization.
afterAll(() => {
  try {
    expect(jest.getTimerCount()).toBe(0);

    for (const store of stores) {
      expect(store.current.size).toBe(0);
      expect(store.previous.size).toBe(0);
    }
  } finally {
    jest.useRealTimers();
  }
});

it('keeps rate-limit stores active until suite teardown, including after restoring mocks', async () => {
  for (let index = 0; index < 2; index += 1) {
    jest.restoreAllMocks();

    const store = new MemoryStore();
    stores.push(store);
    rateLimit({ store, windowMs: 1000, limit: 2 });

    expect((await store.increment('client')).totalHits).toBe(1);
    expect((await store.increment('client')).totalHits).toBe(2);
  }

  expect(jest.getTimerCount()).toBe(stores.length);

  jest.advanceTimersByTime(1000);
  const activeStore = stores[stores.length - 1];
  expect((await activeStore.increment('client')).totalHits).toBe(1);
});

it('cleans up stores reinitialized during a suite', () => {
  const store = new MemoryStore();
  stores.push(store);
  rateLimit({ store, windowMs: 1000 });
  rateLimit({ store, windowMs: 2000, validate: { unsharedStore: false } });

  expect(jest.getTimerCount()).toBe(stores.length);
});
