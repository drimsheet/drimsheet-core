import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { IUser } from '@domain/user/types/user.types';

import authError from '@app/auth/errors/auth.error';
import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag.service.mock';

import { tokenAppService } from '@infra/ioc/services/auth';
import * as accountingUsecases from '@infra/ioc/usecases/accounting';
import accountingRepos from '@infra/persistence/repos/accounting';
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

jest.mock('../../../src/infra/ioc/usecases/accounting', () => ({
  __esModule: true,
  createAccountingEntityUseCase: jest.fn(),
  getJurisdictionsUseCase: jest.fn(),
  getUserAccountingEntitiesUseCase: jest.fn(),
  getActiveAccountingEntityUseCase: jest.fn(),
}));

jest.mock('../../../src/infra/persistence/repos/accounting', () => ({
  __esModule: true,
  default: {
    accountingEntity: { findByIdAndUserId: jest.fn() },
  },
}));

jest.mock('../../../src/infra/persistence/repos/user', () => ({
  __esModule: true,
  default: { user: { findById: jest.fn() } },
}));

const ENDPOINT = '/api/v1/accounting/accounting-entities';
const userId = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
const entity: IAccountingEntity = {
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  id: '123e4567-e89b-12d3-a456-426614174001' as TEntityId,
  ownerId: userId,
  name: 'Ada Consulting',
  type: 'individual',
  functionalCurrencyCode: 'USD',
  jurisdictionCode: 'US',
  createdAt: new Date('2026-07-26T10:00:00.000Z'),
  updatedAt: new Date('2026-07-26T10:00:00.000Z'),
};

describe('GET /accounting/accounting-entities', () => {
  let app: Express;
  const mockGetAuthUser = tokenAppService.getAuthUser as jest.Mock;
  const mockFindUser = userRepos.user.findById as jest.Mock;
  const mockFindEntity = accountingRepos.accountingEntity
    .findByIdAndUserId as jest.Mock;
  const mockGetEntities =
    accountingUsecases.getUserAccountingEntitiesUseCase as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(true);
    mockGetAuthUser.mockResolvedValue({ id: userId });
    mockFindUser.mockResolvedValue({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: userId,
    } as IUser);
    mockFindEntity.mockResolvedValue(null);
    mockGetEntities.mockResolvedValue([entity]);
    app = createApplication();
  });

  describe('200 Response', () => {
    it('returns the authenticated user entity contract', async () => {
      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.body).toEqual([
        {
          ...entity,
          createdAt: entity.createdAt.toISOString(),
          updatedAt: entity.updatedAt.toISOString(),
        },
      ]);
      expect(mockGetEntities).toHaveBeenCalledWith();
    });

    it('returns an empty list when the user has no entities', async () => {
      mockGetEntities.mockResolvedValue([]);

      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('ignores caller-supplied user identifiers', async () => {
      const foreignUserId = '999e4567-e89b-12d3-a456-426614174999';

      const response = await request(app)
        .get(`${ENDPOINT}?userId=${foreignUserId}`)
        .set('Authorization', 'Bearer valid-token')
        .set('x-user-id', foreignUserId);

      expect(response.status).toBe(200);
      expect(mockGetEntities).toHaveBeenCalledWith();
    });

    it('does not disclose an inaccessible entity supplied as context', async () => {
      mockFindEntity.mockResolvedValue(null);

      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .set('x-accounting-entity-id', entity.id);

      expect(response.status).toBe(200);
      expect(mockFindEntity).toHaveBeenCalledWith(
        entity.id,
        userId,
        expect.any(Object)
      );
      expect(mockGetEntities).toHaveBeenCalledTimes(1);
    });
  });

  describe('400 Response', () => {
    it('rejects a malformed accounting entity header before orchestration', async () => {
      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .set('x-accounting-entity-id', 'not-a-uuid');

      expect(response.status).toBe(400);
      expect(mockGetEntities).not.toHaveBeenCalled();
    });
  });

  describe('401 Response', () => {
    it.each([
      ['missing authorization', undefined],
      ['wrong authorization scheme', 'Basic token'],
      ['authorization with extra segments', 'Bearer token extra'],
    ])('rejects %s', async (_label, authorization) => {
      const requestBuilder = request(app).get(ENDPOINT);
      if (authorization) requestBuilder.set('Authorization', authorization);

      const response = await requestBuilder;

      expect(response.status).toBe(401);
      expect(mockGetEntities).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      mockGetAuthUser.mockRejectedValue(new authError.ExpiredToken());

      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer expired-token');

      expect(response.status).toBe(401);
      expect(mockGetEntities).not.toHaveBeenCalled();
    });

    it('rejects a nonexistent user', async () => {
      mockFindUser.mockResolvedValue(null);

      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(401);
      expect(mockGetEntities).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('rejects a user without Alpha 1 access', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValueOnce(false);

      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        name: 'FeatureFlagError',
        errorKey: 'feature_flag_error_forbidden',
      });
      expect(mockGetEntities).not.toHaveBeenCalled();
    });
  });

  describe('500 Response', () => {
    it('sanitizes unexpected failures', async () => {
      mockGetEntities.mockRejectedValue(new Error('database credentials'));

      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        name: 'InternalServerError',
        errorKey: 'app_error_unexpected',
      });
      expect(JSON.stringify(response.body)).not.toContain('credentials');
    });
  });
});
