import { Server } from 'node:http';

import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { IAccountingContext } from '@domain/accounting/types/context.types';
import { IUser } from '@domain/user/types/user.types';

import accountingAppError from '@app/accounting/errors/accounting.error';
import authError from '@app/auth/errors/auth.error';
import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag-app.service.mock';

import { tokenAppService } from '@infra/ioc/services/auth';
import * as accountingUsecases from '@infra/ioc/usecases/accounting';
import accountingRepos from '@infra/persistence/repos/accounting';
import userRepos from '@infra/persistence/repos/user';

import createApplication from '@interface/http/application';

import { closeTestServer, startTestServer } from '../../setup/http-listener';

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
  getAccountingContextUseCase: jest.fn(),
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

const fiscalYearId = '123e4567-e89b-12d3-a456-426614174003';
const ENDPOINT = `/api/v1/accounting/fiscal-years/${fiscalYearId}/accounting-context`;
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

const context: IAccountingContext = {
  id: '123e4567-e89b-12d3-a456-426614174002' as TEntityId,
  createdBy: entity.createdBy,
  name: 'Default',
  description: null,
  accountingEntityId: entity.id,
  accountingStandardCode: 'IFRS',
  fiscalYearId: '123e4567-e89b-12d3-a456-426614174003' as TEntityId,
  accountingIntervalId: '123e4567-e89b-12d3-a456-426614174004' as TEntityId,
  createdAt: entity.createdAt,
  updatedAt: entity.updatedAt,
  closedAt: null,
};

describe('GET /accounting/fiscal-years/{id}/accounting-context', () => {
  let app: Express;
  let server: Server;
  const getContext = jest.mocked(
    accountingUsecases.getAccountingContextUseCase
  );
  const findEntity = jest.mocked(
    accountingRepos.accountingEntity.findByIdAndUserId
  );
  const getUser = jest.mocked(tokenAppService.getAuthUser);

  beforeEach(async () => {
    jest.resetAllMocks();
    mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(true);
    getUser.mockResolvedValue({ id: userId });
    jest.mocked(userRepos.user.findById).mockResolvedValue({
      id: userId,
      actorId: entity.createdBy,
      createdBy: entity.createdBy,
    } as IUser);
    findEntity.mockResolvedValue(entity);
    getContext.mockResolvedValue(context);
    app = createApplication();
    server = await startTestServer(app);
  });

  afterEach(async () => {
    await closeTestServer(server);
  });

  function get() {
    return request(server)
      .get(ENDPOINT)
      .set('Authorization', 'Bearer token')
      .set('x-accounting-entity-id', entity.id);
  }

  describe('200 Response', () => {
    it('returns the domain context as JSON', async () => {
      const response = await get();
      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.body).toEqual(JSON.parse(JSON.stringify(context)));
      expect(getContext).toHaveBeenCalledWith(fiscalYearId);
      expect(findEntity).toHaveBeenCalledWith(
        entity.id,
        userId,
        expect.any(Object)
      );
    });

    it('returns closed contexts', async () => {
      const closedContext = { ...context, closedAt: new Date('2026-12-31') };
      getContext.mockResolvedValue(closedContext);
      const response = await get();
      expect(response.status).toBe(200);
      expect(response.body).toEqual(JSON.parse(JSON.stringify(closedContext)));
    });

    it('returns JSON null when the fiscal year has no context', async () => {
      getContext.mockResolvedValue(null);
      const response = await get();
      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.text).toBe('null');
      expect(response.body).toBeNull();
      expect(getContext).toHaveBeenCalledWith(fiscalYearId);
    });

    it('uses the entity header even when the query supplies a different entity ID', async () => {
      const response = await get().query({
        accountingEntityId: '123e4567-e89b-12d3-a456-426614174099' as TEntityId,
      });
      expect(response.status).toBe(200);
      expect(findEntity).toHaveBeenCalledWith(
        entity.id,
        userId,
        expect.any(Object)
      );
      expect(getContext).toHaveBeenCalledWith(fiscalYearId);
    });
  });

  describe('400 Response', () => {
    it('rejects malformed entity headers before orchestration', async () => {
      const response = await get().set('x-accounting-entity-id', 'bad-id');
      expect(response.status).toBe(400);
      expect(getContext).not.toHaveBeenCalled();
    });
  });

  describe('401 Response', () => {
    it('rejects requests without authentication', async () => {
      const response = await request(server)
        .get(ENDPOINT)
        .set('x-accounting-entity-id', entity.id);
      expect(response.status).toBe(401);
      expect(getContext).not.toHaveBeenCalled();
    });

    it('rejects expired tokens', async () => {
      getUser.mockRejectedValue(new authError.ExpiredToken());
      expect((await get()).status).toBe(401);
      expect(getContext).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('rejects an entity belonging to another owner', async () => {
      findEntity.mockResolvedValue({
        ...entity,
        ownerId: 'b2222222-2222-4222-8222-222222222222' as TEntityId,
      });
      expect((await get()).status).toBe(403);
      expect(getContext).not.toHaveBeenCalled();
    });

    it('enforces alpha access', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(false);
      expect((await get()).status).toBe(403);
      expect(getContext).not.toHaveBeenCalled();
    });
  });

  describe('404 Response', () => {
    it('maps missing or out-of-scope fiscal years to not found', async () => {
      getContext.mockRejectedValue(new accountingAppError.FiscalYearNotFound());
      const response = await get();
      expect(response.status).toBe(404);
      expect(response.body.errorKey).toBe(
        'app_error_accounting_fiscal_year_not_found'
      );
    });

    it('removes the old collection endpoint', async () => {
      const response = await request(server).get(
        '/api/v1/accounting/accounting-contexts'
      );
      expect(response.status).toBe(404);
      expect(getContext).not.toHaveBeenCalled();
    });
  });

  describe('422 Response', () => {
    it('maps invalid fiscal year IDs to the validation envelope', async () => {
      getContext.mockRejectedValue(
        new appError.UnprocessableEntity([
          {
            field: 'fiscalYearId',
            message: 'accounting_error_fiscal_year_id_invalid',
          },
        ])
      );
      const response = await request(server)
        .get('/api/v1/accounting/fiscal-years/invalid/accounting-context')
        .set('Authorization', 'Bearer token')
        .set('x-accounting-entity-id', entity.id);
      expect(response.status).toBe(422);
      expect(response.body.errorKey).toBe('app_error_validation_error');
      expect(getContext).toHaveBeenCalledWith('invalid');
    });
  });

  describe('500 Response', () => {
    it('sanitizes read failures', async () => {
      getContext.mockRejectedValue(new Error('database credentials'));
      const response = await get();
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        name: 'InternalServerError',
        errorKey: 'app_error_unexpected',
      });
    });

    it('does not read contexts when the entity header is missing', async () => {
      const response = await request(server)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer token');
      expect(response.status).toBe(500);
      expect(getContext).not.toHaveBeenCalled();
    });

    it('does not read contexts when the entity header cannot be resolved for the user', async () => {
      findEntity.mockResolvedValue(null);
      expect((await get()).status).toBe(500);
      expect(getContext).not.toHaveBeenCalled();
    });
  });
});
