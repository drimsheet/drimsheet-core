import { TEntityId } from '@shared/types/uuid';
import runtimeError from '@shared/values/errors/runtime.error';

import actorEntity from '@domain/user/entities/actor.entity';

import { IAppContextData } from '@app/context/types/app-context.types';

import appContext from '@infra/services/app-context.service';

describe('appContext', () => {
  const makeStore = (correlationId = 'correlation-id'): IAppContextData => ({
    correlationId,
    idempotencyKey: '',
  });

  it('throws when no store is active', () => {
    expect(() => appContext.get()).toThrow(runtimeError.StoreNotFound);
  });

  it('returns the active store without requiring optional enrichments', () => {
    const store = makeStore();

    const activeStore = appContext.init(store, () => appContext.get());

    expect(activeStore).toBe(store);
  });

  it('returns a store when every required key is present', () => {
    const user = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'user-id',
    } as IAppContextData['user'];
    const accountingEntity = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'accounting-entity-id',
    } as IAppContextData['accountingEntity'];
    const store = { ...makeStore(), user, accountingEntity };

    const activeStore = appContext.init(store, () =>
      appContext.get(['user', 'accountingEntity'])
    );

    expect(activeStore.user).toBe(user);
    expect(activeStore.accountingEntity).toBe(accountingEntity);
  });

  it('reports every missing required key and the active correlation', () => {
    const store = makeStore('missing-context-correlation');

    expect.assertions(3);

    appContext.init(store, () => {
      try {
        appContext.get(['user', 'accountingEntity']);
      } catch (error) {
        expect(error).toBeInstanceOf(runtimeError.ContextNotFound);
        expect((error as Error).message).toBe(
          'runtime_error_context_context_not_found_unexpected'
        );
        expect((error as InstanceType<typeof runtimeError.Base>).cause).toEqual(
          {
            requiredKeys: ['user', 'accountingEntity'],
            missingKeys: ['user', 'accountingEntity'],
            correlationId: 'missing-context-correlation',
          }
        );
      }
    });
  });

  it('treats null and undefined as missing but preserves other falsey values', () => {
    const store = {
      ...makeStore(),
      idempotencyKey: '',
      user: null,
    } as unknown as IAppContextData;

    appContext.init(store, () => {
      expect(() => appContext.get(['user'])).toThrow(
        runtimeError.ContextNotFound
      );
      expect(appContext.get(['idempotencyKey']).idempotencyKey).toBe('');
    });
  });

  it('enriches the active store through set', () => {
    const store = makeStore();
    const user = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'user-id',
    } as IAppContextData['user'];

    appContext.init(store, () => {
      appContext.set({ user });

      expect(appContext.get(['user']).user).toBe(user);
    });
  });

  it('returns synchronous and asynchronous callback results', async () => {
    expect(appContext.init(makeStore(), () => 'sync-result')).toBe(
      'sync-result'
    );

    await expect(
      appContext.init(makeStore(), async () => 'async-result')
    ).resolves.toBe('async-result');
  });

  it('propagates callback rejection', async () => {
    const callbackError = new Error('callback failed');

    await expect(
      appContext.init(makeStore(), async () => {
        throw callbackError;
      })
    ).rejects.toBe(callbackError);
  });

  it('restores the outer store after nested execution', () => {
    appContext.init(makeStore('outer-correlation'), () => {
      appContext.init(makeStore('inner-correlation'), () => {
        expect(appContext.get().correlationId).toBe('inner-correlation');
      });

      expect(appContext.get().correlationId).toBe('outer-correlation');
    });
  });

  it('isolates concurrent stores', async () => {
    const [firstActor] = actorEntity.makeUser({
      email: 'first@example.com',
      displayName: 'First',
    });
    const [secondActor] = actorEntity.makeSystem(firstActor.id);
    let releaseFirst: (() => void) | undefined;
    const firstCanFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = appContext.init(
      { ...makeStore('first-correlation'), actor: firstActor },
      async () => {
        await firstCanFinish;
        return appContext.get(['actor']);
      }
    );

    const second = appContext.init(
      { ...makeStore('second-correlation'), actor: secondActor },
      async () => {
        expect(appContext.get().correlationId).toBe('second-correlation');
        releaseFirst?.();
        return appContext.get(['actor']);
      }
    );

    await expect(Promise.all([first, second])).resolves.toEqual([
      { ...makeStore('first-correlation'), actor: firstActor },
      { ...makeStore('second-correlation'), actor: secondActor },
    ]);
    expect(() => appContext.get()).toThrow(runtimeError.StoreNotFound);
  });

  it('does not substitute a user actor link for a missing context actor', () => {
    const [actor] = actorEntity.makeUser({
      email: 'user@example.com',
      displayName: 'User',
    });
    appContext.init(
      {
        ...makeStore(),
        user: { actorId: actor.id } as IAppContextData['user'],
      },
      () => {
        expect(() => appContext.get(['actor'])).toThrow(
          runtimeError.ContextNotFound
        );
      }
    );
  });
});
