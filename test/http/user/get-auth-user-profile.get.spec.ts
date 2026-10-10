import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';

import { IUser } from '@domain/user/types/user.types';

import authError from '@app/auth/errors/auth.error';
import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag.service.mock';

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

jest.mock('../../../src/infra/ioc/services/auth', () => {
  return {
    __esModule: true,
    tokenAppService: {
      getAuthUser: jest.fn(),
    },
  };
});

jest.mock('../../../src/infra/persistence/repos/user', () => {
  return {
    __esModule: true,
    default: {
      user: {
        findById: jest.fn(),
      },
    },
  };
});

const ENDPOINT = '/api/v1/users/profile';

describe('GET /users/profile', () => {
  afterEach(() => {
    expect(mockFeatureFlagAppService.canAccessAlpha1).not.toHaveBeenCalled();
  });

  let app: Express;
  const mockGetAuthUser = tokenAppService.getAuthUser as jest.Mock;
  const mockFindUser = userRepos.user.findById as jest.Mock;

  const mockUser: IUser = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: '123e4567-e89b-12d3-a456-426614174000' as TEntityId,
    version: 1,
    email: 'user@example.com',
    emailVerified: true,
    firstName: 'First',
    lastName: 'Last',
    deletedAt: null,
    createdAt: new Date('2026-03-13T00:00:00.000Z'),
    updatedAt: new Date('2026-03-13T00:00:00.000Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApplication();
  });

  describe('200 Response', () => {
    it('returns the profile for an authenticated user with valid token, excluding internal fields', async () => {
      mockGetAuthUser.mockResolvedValue({ id: mockUser.id });
      mockFindUser.mockResolvedValue(mockUser);

      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        emailVerified: mockUser.emailVerified,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        createdAt: mockUser.createdAt.toISOString(),
        updatedAt: mockUser.updatedAt.toISOString(),
      });
      // Assert deletedAt is not in the response
      expect(response.body.deletedAt).toBeUndefined();
      expect(response.body.extraField).toBeUndefined();

      expect(mockGetAuthUser).toHaveBeenCalledWith('valid-token');
      expect(mockFindUser).toHaveBeenCalledWith(
        mockUser.id,
        expect.any(Object)
      );
    });

    it('ignores caller-supplied user identifiers in query, body, or headers', async () => {
      mockGetAuthUser.mockResolvedValue({ id: mockUser.id });
      mockFindUser.mockResolvedValue(mockUser);

      const hackerUserId = '999e4567-e89b-12d3-a456-426614174999';

      const response = await request(app)
        .get(`${ENDPOINT}?userId=${hackerUserId}`)
        .send({ userId: hackerUserId })
        .set('Authorization', 'Bearer valid-token')
        .set('x-user-id', hackerUserId);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(mockUser.id);
      expect(mockFindUser).toHaveBeenCalledWith(
        mockUser.id,
        expect.any(Object)
      );
      expect(mockFindUser).not.toHaveBeenCalledWith(
        hackerUserId,
        expect.any(Object)
      );
    });
  });

  describe('401 Response', () => {
    it('rejects if Authorization header is missing', async () => {
      const response = await request(app).get(ENDPOINT);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        name: 'Unauthorized',
        errorKey: 'app_error_unauthorized',
      });
      expect(mockFindUser).not.toHaveBeenCalled();
    });

    it('rejects if Authorization header has a wrong scheme', async () => {
      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Basic token');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        name: 'Unauthorized',
        errorKey: 'app_error_unauthorized',
      });
      expect(mockFindUser).not.toHaveBeenCalled();
    });

    it('rejects if Authorization header has extra segments', async () => {
      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer token extra');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        name: 'Unauthorized',
        errorKey: 'app_error_unauthorized',
      });
      expect(mockFindUser).not.toHaveBeenCalled();
    });

    it('rejects if the token is invalid or expired', async () => {
      mockGetAuthUser.mockRejectedValue(new authError.ExpiredToken());

      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        name: 'AuthError',
        errorKey: 'auth_error_token_expired_unauthorized',
      });
      expect(mockFindUser).not.toHaveBeenCalled();
    });

    it('rejects if the user does not exist in repository', async () => {
      mockGetAuthUser.mockResolvedValue({ id: mockUser.id });
      mockFindUser.mockResolvedValue(null);

      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        name: 'Unauthorized',
        errorKey: 'app_error_unauthorized',
      });
    });
  });

  describe('500 Response', () => {
    it('sanitizes user repository failures and returns InternalServerError', async () => {
      mockGetAuthUser.mockResolvedValue({ id: mockUser.id });
      mockFindUser.mockRejectedValue(new Error('Database breakdown'));

      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        name: 'InternalServerError',
        errorKey: 'app_error_unexpected',
      });
    });
  });
});
