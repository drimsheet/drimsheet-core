import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';

import actorEntity from '@domain/user/entities/actor.entity';
import { IUser } from '@domain/user/types/user.types';

import authError from '@app/auth/errors/auth.error';
import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag.service.mock';
import { mockActorService } from '@app/user/contracts/__mocks__/actor.services.mock';
import {
  EAppThemePreference,
  EAppUsageModePreference,
  IUserPreferences,
} from '@app/user/types/user-preferences.types';

import { tokenAppService } from '@infra/ioc/services/auth';
import userRepos from '@infra/persistence/repos/user';
import { createApplication } from '@infra/server';

jest.mock('@infra/ioc/services/user', () => ({
  ...jest.requireActual('@infra/ioc/services/user'),
  actorService: jest.requireActual(
    '@app/user/contracts/__mocks__/actor.services.mock'
  ).mockActorService,
}));

jest.mock(
  '@infra/integrations/launchdarkly/launchdarkly-feature-flag.service',
  () => ({
    __esModule: true,
    default: jest.requireActual<
      typeof import('@app/context/contracts/__mocks__/feature-flag.service.mock')
    >('@app/context/contracts/__mocks__/feature-flag.service.mock').default,
  })
);

jest.mock('../../../src/infra/ioc/services/auth', () => ({
  __esModule: true,
  tokenAppService: { getAuthUser: jest.fn() },
}));

jest.mock('../../../src/infra/persistence/repos/user', () => ({
  __esModule: true,
  default: {
    user: { findById: jest.fn() },
    userPreferences: {
      findById: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const ENDPOINT = '/api/v1/users/preferences';
const userId = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;

describe('PATCH /users/preferences', () => {
  afterEach(() => {
    expect(mockFeatureFlagAppService.canAccessAlpha1).not.toHaveBeenCalled();
  });

  let app: Express;
  const mockGetAuthUser = tokenAppService.getAuthUser as jest.Mock;
  const mockFindUser = userRepos.user.findById as jest.Mock;
  const mockFindPreferences = userRepos.userPreferences.findById as jest.Mock;
  const mockUpdatePreferences = userRepos.userPreferences.update as jest.Mock;

  const user = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: userId,
  } as IUser;
  const existingPreferences: IUserPreferences = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    userId,
    lastActiveAccountingEntityId: null,
    appPreferences: {
      theme: EAppThemePreference.Light,
      appUsageMode: EAppUsageModePreference.NonPowerUser,
    },
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-02T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockActorService.resolveUser.mockReset().mockResolvedValue({
      ...actorEntity.makeUser({
        email: 'user@example.com',
        displayName: 'User',
      })[0],
      id: user.actorId,
    });
    mockGetAuthUser.mockResolvedValue({ id: userId });
    mockFindUser.mockResolvedValue(user);
    mockFindPreferences.mockResolvedValue(existingPreferences);
    mockUpdatePreferences.mockResolvedValue(undefined);
    app = createApplication();
  });

  describe('200 Response', () => {
    it('updates and returns the authenticated user preferences', async () => {
      const response = await request(app)
        .patch(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .send({ theme: EAppThemePreference.Dark });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        userId,
        lastActiveAccountingEntityId: null,
        appPreferences: {
          theme: EAppThemePreference.Dark,
          appUsageMode: EAppUsageModePreference.NonPowerUser,
        },
        createdAt: existingPreferences.createdAt.toISOString(),
        updatedAt: expect.any(String),
      });
      expect(mockFindPreferences).toHaveBeenCalledWith(
        userId,
        expect.any(Object)
      );
      expect(mockUpdatePreferences).toHaveBeenCalledWith(
        expect.objectContaining({
          createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
          userId,
          appPreferences: response.body.appPreferences,
          createdAt: existingPreferences.createdAt,
        }),
        expect.any(Object)
      );
    });
  });

  describe('401 Response', () => {
    it('rejects a missing authorization header before persistence', async () => {
      const response = await request(app)
        .patch(ENDPOINT)
        .send({ theme: EAppThemePreference.Dark });

      expect(response.status).toBe(401);
      expect(mockUpdatePreferences).not.toHaveBeenCalled();
    });

    it('rejects an expired bearer token', async () => {
      mockGetAuthUser.mockRejectedValue(new authError.ExpiredToken());

      const response = await request(app)
        .patch(ENDPOINT)
        .set('Authorization', 'Bearer expired-token')
        .send({ theme: EAppThemePreference.Dark });

      expect(response.status).toBe(401);
      expect(mockUpdatePreferences).not.toHaveBeenCalled();
    });
  });

  describe('422 Response', () => {
    it.each([
      ['an empty update', {}],
      ['a null theme', { theme: null }],
      ['a null app usage mode', { appUsageMode: null }],
      ['an unknown preference', { compact: true }],
      ['an unsupported theme', { theme: 'sepia' }],
      [
        'a caller-supplied user ID',
        {
          userId: '123e4567-e89b-12d3-a456-426614174999',
          theme: EAppThemePreference.Dark,
        },
      ],
    ])('rejects %s before persistence', async (_label, payload) => {
      const response = await request(app)
        .patch(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .send(payload);

      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({
        name: 'UnprocessableEntity',
        errorKey: 'app_error_validation_error',
      });
      expect(mockUpdatePreferences).not.toHaveBeenCalled();
    });
  });

  describe('500 Response', () => {
    it('sanitizes unexpected persistence failures', async () => {
      mockUpdatePreferences.mockRejectedValue(
        new Error('database credentials leaked')
      );

      const response = await request(app)
        .patch(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .send({ theme: EAppThemePreference.System });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        name: 'InternalServerError',
        errorKey: 'app_error_unexpected',
      });
      expect(JSON.stringify(response.body)).not.toContain(
        'database credentials'
      );
    });
  });
});
