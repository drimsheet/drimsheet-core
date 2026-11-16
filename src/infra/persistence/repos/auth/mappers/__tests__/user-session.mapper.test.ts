import { TEntityId } from '@shared/types/uuid';

import { IUserSession } from '@app/auth/types/auth.types';

import userSessionMapper, {
  IUserSessionModel,
} from '@infra/persistence/repos/auth/mappers/user-session.mapper';

describe('User Session Mapper', () => {
  const createdAt = new Date('2026-05-01T00:00:00.000Z');
  const lastLoginAt = new Date('2026-05-01T01:00:00.000Z');
  const id = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const userId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-02T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('toRepo', () => {
    it('maps a user session to a repo model', () => {
      const session: IUserSession = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id,
        userId,
        refreshToken: 'refresh-token',
        lastLoginAt,
        createdAt,
      };

      expect(userSessionMapper.toRepo(session)).toEqual({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id,
        userId,
        refreshToken: 'refresh-token',
        lastLoginAt: lastLoginAt.toISOString(),
        createdAt: createdAt.toISOString(),
      });
    });

    it('maps a missing last login to repo null', () => {
      const session: IUserSession = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id,
        userId,
        refreshToken: 'refresh-token',
        lastLoginAt: null as unknown as Date,
        createdAt,
      };

      expect(userSessionMapper.toRepo(session).lastLoginAt).toBeNull();
    });
  });

  describe('toDomain', () => {
    it('maps a repo model to a user session', () => {
      const model: IUserSessionModel = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id,
        userId,
        refreshToken: 'refresh-token',
        lastLoginAt: lastLoginAt.toISOString(),
        createdAt: createdAt.toISOString(),
      };

      expect(userSessionMapper.toDomain(model)).toEqual({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id,
        userId,
        refreshToken: 'refresh-token',
        lastLoginAt,
        createdAt,
      });
    });

    it('defaults missing repo last login to the current time', () => {
      const model: IUserSessionModel = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id,
        userId,
        refreshToken: 'refresh-token',
        lastLoginAt: null,
        createdAt: createdAt.toISOString(),
      };

      expect(userSessionMapper.toDomain(model).lastLoginAt).toEqual(
        new Date('2026-05-02T00:00:00.000Z')
      );
    });
  });
});
