import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { IUser } from '@domain/user/types/user.types';

import accountingAppError from '@app/accounting/errors/accounting.error';
import authError from '@app/auth/errors/auth.error';
import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag.service.mock';

import { tokenAppService } from '@infra/ioc/services/auth';
import * as accountingUsecases from '@infra/ioc/usecases/accounting';
import observability from '@infra/observability';
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

const ENDPOINT = '/api/v1/accounting/accounting-entity';
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

describe('GET /accounting/accounting-entity', () => {
  let app: Express;
  const mockGetAuthUser = tokenAppService.getAuthUser as jest.Mock;
  const mockFindUser = userRepos.user.findById as jest.Mock;
  const mockFindEntity = accountingRepos.accountingEntity
    .findByIdAndUserId as jest.Mock;
  const mockGetActiveEntity =
    accountingUsecases.getActiveAccountingEntityUseCase as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(true);
    mockGetAuthUser.mockResolvedValue({ id: userId });
    mockFindUser.mockResolvedValue({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: userId,
    } as IUser);
    mockFindEntity.mockResolvedValue(entity);
    mockGetActiveEntity.mockResolvedValue(entity);
    app = createApplication();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('200 Response', () => {
    it('returns the selected owned entity contract with security headers', async () => {
      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .set('x-accounting-entity-id', entity.id);

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.body).toEqual({
        ...entity,
        createdAt: entity.createdAt.toISOString(),
        updatedAt: entity.updatedAt.toISOString(),
      });
      expect(mockFindEntity).toHaveBeenCalledWith(
        entity.id,
        userId,
        expect.any(Object)
      );
      expect(mockGetActiveEntity).toHaveBeenCalledWith();
    });
  });

  describe('400 Response', () => {
    it('rejects a malformed entity ID before orchestration', async () => {
      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .set('x-accounting-entity-id', 'not-a-uuid');

      expect(response.status).toBe(400);
      expect(mockGetActiveEntity).not.toHaveBeenCalled();
    });
  });

  describe('401 Response', () => {
    it('rejects missing authorization', async () => {
      const response = await request(app)
        .get(ENDPOINT)
        .set('x-accounting-entity-id', entity.id);

      expect(response.status).toBe(401);
      expect(mockGetActiveEntity).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      const correlationId = '0198ad49-0f4a-7709-a5bf-2f7cfbaea7c4';
      const warnSpy = jest
        .spyOn(observability.logger, 'warn')
        .mockImplementation(() => undefined);
      mockGetAuthUser.mockRejectedValue(new authError.ExpiredToken());

      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer expired-token')
        .set('x-accounting-entity-id', entity.id)
        .set('x-correlation-id', correlationId);

      expect(response.status).toBe(401);
      expect(response.headers['x-correlation-id']).toBe(correlationId);
      expect(warnSpy).toHaveBeenCalledWith(
        'http.request.completed',
        expect.objectContaining({
          httpMethod: 'GET',
          httpRoute: 'unmatched',
          statusCode: 401,
          outcome: 'rejected',
        })
      );
      expect(mockGetActiveEntity).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('rejects a user without Alpha 1 access', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValueOnce(false);

      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .set('x-accounting-entity-id', entity.id);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        name: 'FeatureFlagError',
        errorKey: 'feature_flag_error_forbidden',
      });
      expect(mockGetActiveEntity).not.toHaveBeenCalled();
    });
  });

  describe('404 Response', () => {
    it.each([
      ['missing ID', undefined],
      ['unknown ID', entity.id],
      ['inaccessible ID', entity.id],
    ])('does not disclose entity existence for %s', async (_label, id) => {
      mockFindEntity.mockResolvedValue(null);
      mockGetActiveEntity.mockRejectedValue(
        new accountingAppError.ActiveEntityNotFound()
      );
      const requestBuilder = request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token');
      if (id) requestBuilder.set('x-accounting-entity-id', id);

      const response = await requestBuilder;

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        name: 'AccountingAppError',
        errorKey: 'app_error_accounting_active_entity_not_found',
      });
      expect(JSON.stringify(response.body)).not.toContain(entity.name);
    });
  });

  describe('500 Response', () => {
    it('sanitizes unexpected failures', async () => {
      mockGetActiveEntity.mockRejectedValue(new Error('database credentials'));

      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .set('x-accounting-entity-id', entity.id);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        name: 'InternalServerError',
        errorKey: 'app_error_unexpected',
      });
      expect(JSON.stringify(response.body)).not.toContain('credentials');
    });
  });
});
