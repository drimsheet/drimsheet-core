import { TEntityId } from '@shared/types/uuid';

import { EAuthStrategy } from '@app/auth/contracts/auth.types';
import makeUserAuthAppService from '@app/auth/services/user-auth.service';

describe('userAuthAppService', () => {
  const userId = '123e4567-e89b-42d3-a456-426614174000' as TEntityId;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates immutable version one authentication state', () => {
    const service = makeUserAuthAppService();

    const userAuth = service.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      userId,
      password: 'password-hash',
      strategy: EAuthStrategy.Email,
    });

    expect(userAuth).toEqual({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      userId,
      password: 'password-hash',
      failedLoginAttempts: 0,
      strategy: [EAuthStrategy.Email],
      version: 1,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    });
    expect(Object.isFrozen(userAuth)).toBe(true);
    expect(Object.isFrozen(userAuth.strategy)).toBe(true);
  });

  it('adds a strategy and advances the version', () => {
    const service = makeUserAuthAppService();
    const userAuth = service.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      userId,
      password: 'password-hash',
      strategy: EAuthStrategy.Email,
    });

    const updated = service.addStrategy(userAuth, EAuthStrategy.Google);

    expect(updated.strategy).toEqual([
      EAuthStrategy.Email,
      EAuthStrategy.Google,
    ]);
    expect(updated.version).toBe(2);
    expect(updated.createdAt).toBe(userAuth.createdAt);
    expect(Object.isFrozen(updated)).toBe(true);
    expect(Object.isFrozen(updated.strategy)).toBe(true);
  });

  it('replaces the password, restores email strategy, and advances the version', () => {
    const service = makeUserAuthAppService();
    const userAuth = service.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      userId,
      password: null,
      strategy: EAuthStrategy.Google,
    });

    const updated = service.replacePassword(userAuth, 'new-hash');

    expect(updated.password).toBe('new-hash');
    expect(updated.failedLoginAttempts).toBe(0);
    expect(updated.strategy).toEqual([
      EAuthStrategy.Google,
      EAuthStrategy.Email,
    ]);
    expect(updated.version).toBe(2);
  });

  it('preserves an existing email strategy when replacing the password', () => {
    const service = makeUserAuthAppService();
    const userAuth = service.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      userId,
      password: 'old-hash',
      strategy: EAuthStrategy.Email,
    });

    const updated = service.replacePassword(userAuth, 'new-hash');

    expect(updated.strategy).toEqual([EAuthStrategy.Email]);
    expect(updated.version).toBe(2);
  });

  it('records and resets failed login attempts through separate versions', () => {
    const service = makeUserAuthAppService();
    const userAuth = service.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      userId,
      password: 'password-hash',
      strategy: EAuthStrategy.Email,
    });

    const failedLogin = service.recordFailedLogin(userAuth);
    const resetLogin = service.resetFailedLoginAttempts(failedLogin);

    expect(failedLogin.failedLoginAttempts).toBe(1);
    expect(failedLogin.version).toBe(2);
    expect(resetLogin.failedLoginAttempts).toBe(0);
    expect(resetLogin.version).toBe(3);
  });

  it('preserves identity for unchanged transitions', () => {
    const service = makeUserAuthAppService();
    const userAuth = service.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      userId,
      password: 'password-hash',
      strategy: EAuthStrategy.Email,
    });

    expect(service.addStrategy(userAuth, EAuthStrategy.Email)).toBe(userAuth);
    expect(service.resetFailedLoginAttempts(userAuth)).toBe(userAuth);
  });
});
