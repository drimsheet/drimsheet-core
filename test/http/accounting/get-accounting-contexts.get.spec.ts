import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { IUser } from '@domain/user/types/user.types';

import { IAccountingContextDto } from '@app/accounting/dtos/accounting-context/accounting-context.dto';
import authError from '@app/auth/errors/auth.error';
import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag-app.service.mock';

import { tokenAppService } from '@infra/ioc/services/auth';
import * as accountingUsecases from '@infra/ioc/usecases/accounting';
import accountingRepos from '@infra/persistence/repos/accounting';
import userRepos from '@infra/persistence/repos/user';

import createApplication from '@interface/http/application';

jest.mock('@infra/ioc/services/user', () => ({
  ...jest.requireActual('@infra/ioc/services/user'),
  actorService: jest.requireActual(
    '@app/user/contracts/__mocks__/actor.services.mock'
  ).mockActorService,
}));

jest.mock('@infra/ioc/services/context', () => ({
  __esModule: true,
  featureFlagAppService: jest.requireActual<
    typeof import('@app/context/contracts/__mocks__/feature-flag-app.service.mock')
  >('@app/context/contracts/__mocks__/feature-flag-app.service.mock').default,
}));

jest.mock('@infra/ioc/services/auth', () => ({
  __esModule: true,
  tokenAppService: jest.requireActual(
    '@app/auth/contracts/__mocks__/token-service.mock'
  ).default,
}));

jest.mock('@infra/ioc/usecases/accounting', () => ({
  __esModule: true,
  createAccountingEntityUseCase: jest.fn(),
  getJurisdictionsUseCase: jest.fn(),
  getUserAccountingEntitiesUseCase: jest.fn(),
  getActiveAccountingEntityUseCase: jest.fn(),
  getAccountingContextsUseCase: jest.fn(),
}));

jest.mock('@infra/persistence/repos/accounting', () => ({
  __esModule: true,
  default: {
    accountingEntity: jest.requireActual(
      '@app/accounting/contracts/__mocks__/accounting.repos.mock'
    ).mockAccountingEntityRepo,
  },
}));

jest.mock('@infra/persistence/repos/user', () => ({
  __esModule: true,
  default: {
    user: jest.requireActual('@app/user/contracts/__mocks__/user.repos.mock')
      .mockUserRepo,
  },
}));

const ENDPOINT = '/api/v1/accounting/accounting-contexts';
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

const context: IAccountingContextDto = {
  id: '123e4567-e89b-12d3-a456-426614174002',
  createdBy: entity.createdBy,
  name: 'Default',
  description: null,
  accountingEntityId: entity.id,
  accountingStandardCode: 'IFRS',
  fiscalYearId: '123e4567-e89b-12d3-a456-426614174003',
  currentAccountingPeriodId: '123e4567-e89b-12d3-a456-426614174004',
  createdAt: entity.createdAt,
  updatedAt: entity.updatedAt,
  closedAt: null,
  fiscalYear: {
    id: '123e4567-e89b-12d3-a456-426614174003',
    createdBy: entity.createdBy,
    name: '2026',
    accountingEntityId: entity.id,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    status: 'open',
    closedAt: null,
    updatedAt: entity.updatedAt,
  },
  accountingPeriods: [
    {
      id: '123e4567-e89b-12d3-a456-426614174004',
      createdBy: entity.createdBy,
      name: 'January',
      accountingEntityId: entity.id,
      fiscalYearId: '123e4567-e89b-12d3-a456-426614174003',
      unit: 'month',
      count: 12,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-31'),
      status: 'closed',
      closedAt: new Date('2026-02-01'),
      updatedAt: entity.updatedAt,
    },
  ],
};

describe('GET /accounting/accounting-contexts', () => {
  let app: Express;
  const getContexts = jest.mocked(
    accountingUsecases.getAccountingContextsUseCase
  );
  const findEntity = jest.mocked(
    accountingRepos.accountingEntity.findByIdAndUserId
  );
  const getUser = jest.mocked(tokenAppService.getAuthUser);

  beforeEach(() => {
    jest.resetAllMocks();
    mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(true);
    getUser.mockResolvedValue({ id: userId });
    jest.mocked(userRepos.user.findById).mockResolvedValue({
      id: userId,
      actorId: entity.createdBy,
      createdBy: entity.createdBy,
    } as IUser);
    findEntity.mockResolvedValue(entity);
    getContexts.mockResolvedValue([context]);
    app = createApplication();
  });

  function get() {
    return request(app)
      .get(ENDPOINT)
      .set('Authorization', 'Bearer token')
      .set('x-accounting-entity-id', entity.id);
  }

  describe('200 Response', () => {
    it('returns all contexts with nested fiscal years and periods as JSON', async () => {
      const second = {
        ...context,
        id: '123e4567-e89b-12d3-a456-426614174005',
        name: 'Second context',
      };
      getContexts.mockResolvedValue([context, second]);
      const response = await get();
      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.body).toEqual(
        JSON.parse(JSON.stringify([context, second]))
      );
      expect(getContexts).toHaveBeenCalledWith();
      expect(findEntity).toHaveBeenCalledWith(
        entity.id,
        userId,
        expect.any(Object)
      );
    });

    it('returns an empty array when there are no active contexts', async () => {
      getContexts.mockResolvedValue([]);
      const response = await get();
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('uses the entity header even when the query supplies a different entity ID', async () => {
      const response = await get().query({
        accountingEntityId: '123e4567-e89b-12d3-a456-426614174099',
      });
      expect(response.status).toBe(200);
      expect(findEntity).toHaveBeenCalledWith(
        entity.id,
        userId,
        expect.any(Object)
      );
      expect(getContexts).toHaveBeenCalledWith();
    });
  });

  describe('400 Response', () => {
    it('rejects malformed entity headers before orchestration', async () => {
      const response = await get().set('x-accounting-entity-id', 'bad-id');
      expect(response.status).toBe(400);
      expect(getContexts).not.toHaveBeenCalled();
    });
  });

  describe('401 Response', () => {
    it('rejects requests without authentication', async () => {
      const response = await request(app)
        .get(ENDPOINT)
        .set('x-accounting-entity-id', entity.id);
      expect(response.status).toBe(401);
      expect(getContexts).not.toHaveBeenCalled();
    });

    it('rejects expired tokens', async () => {
      getUser.mockRejectedValue(new authError.ExpiredToken());
      expect((await get()).status).toBe(401);
      expect(getContexts).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('rejects an entity belonging to another owner', async () => {
      findEntity.mockResolvedValue({
        ...entity,
        ownerId: 'b2222222-2222-4222-8222-222222222222' as TEntityId,
      });
      expect((await get()).status).toBe(403);
      expect(getContexts).not.toHaveBeenCalled();
    });

    it('enforces alpha access', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(false);
      expect((await get()).status).toBe(403);
      expect(getContexts).not.toHaveBeenCalled();
    });
  });

  describe('500 Response', () => {
    it('sanitizes read failures', async () => {
      getContexts.mockRejectedValue(new Error('database credentials'));
      const response = await get();
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        name: 'InternalServerError',
        errorKey: 'app_error_unexpected',
      });
    });

    it('does not read contexts when the entity header is missing', async () => {
      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer token');
      expect(response.status).toBe(500);
      expect(getContexts).not.toHaveBeenCalled();
    });

    it('does not read contexts when the entity header cannot be resolved for the user', async () => {
      findEntity.mockResolvedValue(null);
      expect((await get()).status).toBe(500);
      expect(getContexts).not.toHaveBeenCalled();
    });
  });
});
