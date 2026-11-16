import { TEntityId } from '@shared/types/uuid';

import { EAuthStrategy, IUserAuth } from '@app/auth/types/auth.types';

import userAuthMapper, {
  IUserAuthModel,
} from '@infra/persistence/repos/auth/mappers/user-auth.mapper';

describe('User Auth Mapper', () => {
  const createdAt = new Date('2026-05-01T00:00:00.000Z');
  const updatedAt = new Date('2026-05-01T01:00:00.000Z');
  const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;

  describe('toRepo', () => {
    it('maps user auth to a repo model', () => {
      const userAuth: IUserAuth = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        userId,
        version: 1,
        password: 'hashed-password',
        failedLoginAttempts: 2,
        strategy: [EAuthStrategy.Email],
        createdAt,
        updatedAt,
      };

      expect(userAuthMapper.toRepo(userAuth)).toEqual({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        userId,
        version: 1,
        password: 'hashed-password',
        failedLoginAttempts: 2,
        strategies: [EAuthStrategy.Email],
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      });
    });

    it('maps a null password to repo null', () => {
      const userAuth: IUserAuth = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        userId,
        version: 1,
        password: null,
        failedLoginAttempts: 0,
        strategy: [EAuthStrategy.Google],
        createdAt,
        updatedAt,
      };

      expect(userAuthMapper.toRepo(userAuth).password).toBeNull();
    });
  });

  describe('toDomain', () => {
    it('maps a repo model to user auth', () => {
      const model: IUserAuthModel = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        userId,
        version: 2,
        password: 'hashed-password',
        failedLoginAttempts: 1,
        strategies: [EAuthStrategy.Email, EAuthStrategy.Google],
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      };

      expect(userAuthMapper.toDomain(model)).toEqual({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        userId,
        version: 2,
        password: 'hashed-password',
        failedLoginAttempts: 1,
        strategy: [EAuthStrategy.Email, EAuthStrategy.Google],
        createdAt,
        updatedAt,
      });
    });

    it('defaults nullable repo fields for the domain shape', () => {
      const model: IUserAuthModel = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        userId,
        version: 3,
        password: null,
        failedLoginAttempts: null,
        strategies: [EAuthStrategy.Google],
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      };

      expect(userAuthMapper.toDomain(model)).toEqual({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        userId,
        version: 3,
        password: null,
        failedLoginAttempts: 0,
        strategy: [EAuthStrategy.Google],
        createdAt,
        updatedAt,
      });
    });
  });
});
