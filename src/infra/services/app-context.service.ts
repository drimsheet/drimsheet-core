import { AsyncLocalStorage } from 'node:async_hooks';

import IAppContextService, {
  TAppContextWithRequiredKeys,
} from '@shared/contracts/app-context.service.contract';
import runtimeError from '@shared/values/errors/runtime.error';

import { IAppContextData } from '@app/context/types/app-context.types';

const asyncLocalStorage = new AsyncLocalStorage<IAppContextData>();

const appContextService: IAppContextService<IAppContextData> = {
  init(store, callback) {
    return asyncLocalStorage.run(store, callback);
  },

  get<K extends keyof IAppContextData = never>(requiredKeys?: readonly K[]) {
    const store = asyncLocalStorage.getStore();

    if (!store) {
      throw new runtimeError.StoreNotFound();
    }

    const missingKeys = requiredKeys?.filter(
      (requiredKey) => store[requiredKey] == null
    );

    if (missingKeys?.length) {
      throw new runtimeError.ContextNotFound({
        requiredKeys,
        missingKeys,
        correlationId: store.correlationId,
      });
    }

    return store as TAppContextWithRequiredKeys<IAppContextData, K>;
  },

  set(store) {
    const currentStore = this.get();
    Object.assign(currentStore, store);
  },
};

export default appContextService;
