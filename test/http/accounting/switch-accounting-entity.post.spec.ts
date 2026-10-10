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
  switchAccountingEntityUseCase: jest.fn(),
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

const ENDPOINT = '/api/v1/accounting/accounting-entity/switch';
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

describe('POST /accounting/accounting-entity/switch', () => {
  let app: Express;
  const mockGetAuthUser = tokenAppService.getAuthUser as jest.Mock;
  const mockFindUser = userRepos.user.findById as jest.Mock;
  const mockSwitchAccountingEntity =
    accountingUsecases.switchAccountingEntityUseCase as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(true);
    mockGetAuthUser.mockResolvedValue({ id: userId });
    mockFindUser.mockResolvedValue({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: userId,
    } as IUser);
    mockSwitchAccountingEntity.mockResolvedValue(entity);
    app = createApplication();
  });

  describe('200 Response', () => {
    it('returns the selected accounting entity contract', async () => {
      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .send({ accountingEntityId: entity.id });

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.body).toEqual({
        ...entity,
        createdAt: entity.createdAt.toISOString(),
        updatedAt: entity.updatedAt.toISOString(),
      });
      expect(mockSwitchAccountingEntity).toHaveBeenCalledWith({
        accountingEntityId: entity.id,
      });
    });

    it('uses the request body target when a prior context header is present', async () => {
      const priorEntityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
      const mockFindEntity = accountingRepos.accountingEntity
        .findByIdAndUserId as jest.Mock;
      mockFindEntity.mockResolvedValue({
        ...entity,
        id: priorEntityId,
      });

      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .set('x-accounting-entity-id', priorEntityId)
        .send({ accountingEntityId: entity.id });

      expect(response.status).toBe(200);
      expect(mockFindEntity).toHaveBeenCalledWith(
        priorEntityId,
        userId,
        expect.any(Object)
      );
      expect(mockSwitchAccountingEntity).toHaveBeenCalledWith({
        accountingEntityId: entity.id,
      });
    });
  });

  describe('401 Response', () => {
    it.each([
      ['missing authorization', undefined],
      ['wrong authorization scheme', 'Basic token'],
      ['authorization with extra segments', 'Bearer token extra'],
    ])('rejects %s', async (_label, authorization) => {
      const requestBuilder = request(app)
        .post(ENDPOINT)
        .send({ accountingEntityId: entity.id });
      if (authorization) requestBuilder.set('Authorization', authorization);

      const response = await requestBuilder;

      expect(response.status).toBe(401);
      expect(mockSwitchAccountingEntity).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      mockGetAuthUser.mockRejectedValue(new authError.ExpiredToken());

      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer expired-token')
        .send({ accountingEntityId: entity.id });

      expect(response.status).toBe(401);
      expect(mockSwitchAccountingEntity).not.toHaveBeenCalled();
    });

    it('rejects a nonexistent user', async () => {
      mockFindUser.mockResolvedValue(null);

      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .send({ accountingEntityId: entity.id });

      expect(response.status).toBe(401);
      expect(mockSwitchAccountingEntity).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('rejects a user without Alpha 1 access', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValueOnce(false);

      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .send({ accountingEntityId: entity.id });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        name: 'FeatureFlagError',
        errorKey: 'feature_flag_error_forbidden',
      });
      expect(mockSwitchAccountingEntity).not.toHaveBeenCalled();
    });
  });

  describe('404 Response', () => {
    it.each(['unknown', 'inaccessible'])(
      'does not disclose an %s accounting entity',
      async () => {
        mockSwitchAccountingEntity.mockRejectedValue(
          new accountingAppError.ActiveEntityNotFound()
        );

        const response = await request(app)
          .post(ENDPOINT)
          .set('Authorization', 'Bearer valid-token')
          .send({ accountingEntityId: entity.id });

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
          name: 'AccountingAppError',
          errorKey: 'app_error_accounting_active_entity_not_found',
        });
        expect(JSON.stringify(response.body)).not.toContain(entity.name);
      }
    );
  });

  describe('422 Response', () => {
    it.each([
      ['a missing accounting entity ID', {}],
      [
        'a caller-supplied user ID',
        {
          accountingEntityId: entity.id,
          userId: '123e4567-e89b-12d3-a456-426614174999',
        },
      ],
    ])('rejects %s before orchestration', async (_label, payload) => {
      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .send(payload);

      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({
        name: 'UnprocessableEntity',
        errorKey: 'app_error_validation_error',
      });
      expect(mockSwitchAccountingEntity).not.toHaveBeenCalled();
    });
  });

  describe('500 Response', () => {
    it('sanitizes unexpected switch failures', async () => {
      mockSwitchAccountingEntity.mockRejectedValue(
        new Error('database credentials')
      );

      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .send({ accountingEntityId: entity.id });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        name: 'InternalServerError',
        errorKey: 'app_error_unexpected',
      });
      expect(JSON.stringify(response.body)).not.toContain('credentials');
    });
  });
});
