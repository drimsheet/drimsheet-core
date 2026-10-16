import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';

import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
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
  updateAccountingEntityUseCase: jest.fn(),
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
  status: 'active',
  functionalCurrencyCode: 'USD',
  jurisdictionCode: 'US',
  createdAt: new Date('2026-07-26T10:00:00.000Z'),
  updatedAt: new Date('2026-07-26T10:00:00.000Z'),
};

describe('PATCH /accounting/accounting-entity', () => {
  let app: Express;
  const update = jest.mocked(accountingUsecases.updateAccountingEntityUseCase);
  const findEntity = jest.mocked(
    accountingRepos.accountingEntity.findByIdAndUserId
  );
  const getUser = jest.mocked(tokenAppService.getAuthUser);
  beforeEach(() => {
    jest.resetAllMocks();
    mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(true);
    getUser.mockResolvedValue({ id: userId } as never);
    jest.mocked(userRepos.user.findById).mockResolvedValue({
      id: userId,
      actorId: entity.createdBy,
      createdBy: entity.createdBy,
    } as IUser);
    findEntity.mockResolvedValue(entity);
    update.mockResolvedValue(entity);
    app = createApplication();
  });

  function patch(payload: object) {
    return request(app)
      .patch(ENDPOINT)
      .set('Authorization', 'Bearer token')
      .set('x-accounting-entity-id', entity.id)
      .send(payload);
  }

  describe('200 Response', () => {
    it('passes a partial update and returns the entity with security headers', async () => {
      const response = await patch({ name: 'Renamed' });
      expect(response.status).toBe(200);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.body).toEqual({
        ...entity,
        createdAt: entity.createdAt.toISOString(),
        updatedAt: entity.updatedAt.toISOString(),
      });
      expect(update).toHaveBeenCalledWith({ name: 'Renamed' });
      expect(findEntity).toHaveBeenCalledWith(
        entity.id,
        userId,
        expect.any(Object)
      );
    });
    it('accepts the canonical private_company value', async () => {
      expect(
        (
          await patch({
            entityType: 'private_company',
            functionalCurrencyCode: 'NGN',
          })
        ).status
      ).toBe(200);
      expect(update).toHaveBeenCalledWith({
        entityType: 'private_company',
        functionalCurrencyCode: 'NGN',
      });
    });
  });
  describe('400 Response', () => {
    it('rejects malformed entity headers', async () => {
      const response = await request(app)
        .patch(ENDPOINT)
        .set('Authorization', 'Bearer token')
        .set('x-accounting-entity-id', 'bad-id')
        .send({ name: 'New' });
      expect(response.status).toBe(400);
      expect(update).not.toHaveBeenCalled();
    });
  });
  describe('401 Response', () => {
    it('rejects unauthenticated requests', async () => {
      getUser.mockRejectedValue(new authError.ExpiredToken());
      const response = await patch({ name: 'New' });
      expect(response.status).toBe(401);
      expect(update).not.toHaveBeenCalled();
    });
  });
  describe('403 Response', () => {
    it('rejects an entity belonging to another owner', async () => {
      findEntity.mockResolvedValue({
        ...entity,
        ownerId: 'b2222222-2222-4222-8222-222222222222' as TEntityId,
      });
      expect((await patch({ name: 'New' })).status).toBe(403);
      expect(update).not.toHaveBeenCalled();
    });
    it('enforces alpha access', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(false);
      expect((await patch({ name: 'New' })).status).toBe(403);
      expect(update).not.toHaveBeenCalled();
    });
  });
  describe('404 Response', () => {
    it('maps an entity removed before the update', async () => {
      update.mockRejectedValue(new accountingAppError.ActiveEntityNotFound());
      expect((await patch({ name: 'New' })).status).toBe(404);
    });
  });
  describe('409 Response', () => {
    it.each([
      accountingEntityError.TypeChangeNotAllowed,
      accountingEntityError.FunctionalCurrencyChangeNotAllowed,
    ])('maps forbidden transitions', async (ErrorType) => {
      const error = new ErrorType();
      update.mockRejectedValue(error);
      const response = await patch({ functionalCurrencyCode: 'NGN' });
      expect(response.status).toBe(409);
      expect(JSON.stringify(response.body)).toContain(error.errorKey);
    });
  });
  describe('422 Response', () => {
    it.each([
      { name: 42 },
      { entityType: 'provate_company' },
      { functionalCurrencyCode: 'ZZZ' },
      { name: 'New', ownerId: userId },
    ])(
      'rejects invalid transport input %j before orchestration',
      async (payload) => {
        expect((await patch(payload)).status).toBe(422);
        expect(update).not.toHaveBeenCalled();
      }
    );
  });
});
