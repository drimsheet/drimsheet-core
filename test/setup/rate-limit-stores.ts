import { MemoryStore } from 'express-rate-limit';

const stores = new Set<MemoryStore>();
const initializeStore = MemoryStore.prototype.init;

// Keep real rate limiting in tests, but give each suite ownership of its stores.
// MemoryStore's unref'ed intervals otherwise retain the completed Jest context.
MemoryStore.prototype.init = function (options) {
  initializeStore.call(this, options);
  stores.add(this);
};

afterAll(() => {
  for (const store of stores) {
    store.shutdown();
  }

  stores.clear();
  MemoryStore.prototype.init = initializeStore;
});
