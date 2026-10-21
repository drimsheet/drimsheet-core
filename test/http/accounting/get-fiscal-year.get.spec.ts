import { Server } from 'node:http';

import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';
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
  getFiscalYearUseCase: jest.fn(),
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

const fiscalYearId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
const ENDPOINT = `/api/v1/accounting/fiscal-years/${fiscalYearId}`;
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

const year: IFiscalYear = {
  id: '123e4567-e89b-12d3-a456-426614174003' as TEntityId,
  createdBy: entity.createdBy,
  name: '2026',
  accountingEntityId: entity.id,
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-12-31'),
  status: 'open',
  closedAt: null,
  updatedAt: entity.updatedAt,
};

describe('GET /accounting/fiscal-years/{id}', () => {
  let app: Express;
  let server: Server;
  const getYear = jest.mocked(accountingUsecases.getFiscalYearUseCase);
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
    getYear.mockResolvedValue(year);
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
    it('returns one fiscal year as a JSON object', async () => {
      const response = await get();
      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.body).toEqual(JSON.parse(JSON.stringify(year)));
      expect(getYear).toHaveBeenCalledWith(fiscalYearId);
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
      expect(getYear).toHaveBeenCalledWith(fiscalYearId);
    });
  });

  describe('400 Response', () => {
    it('rejects malformed entity headers before orchestration', async () => {
      const response = await get().set('x-accounting-entity-id', 'bad-id');
      expect(response.status).toBe(400);
      expect(getYear).not.toHaveBeenCalled();
    });
  });

  describe('401 Response', () => {
    it('rejects requests without authentication', async () => {
      const response = await request(server)
        .get(ENDPOINT)
        .set('x-accounting-entity-id', entity.id);
      expect(response.status).toBe(401);
      expect(getYear).not.toHaveBeenCalled();
    });

    it('rejects expired tokens', async () => {
      getUser.mockRejectedValue(new authError.ExpiredToken());
      expect((await get()).status).toBe(401);
      expect(getYear).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('rejects an entity belonging to another owner', async () => {
      findEntity.mockResolvedValue({
        ...entity,
        ownerId: 'b2222222-2222-4222-8222-222222222222' as TEntityId,
      });
      expect((await get()).status).toBe(403);
      expect(getYear).not.toHaveBeenCalled();
    });

    it('enforces alpha access', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(false);
      expect((await get()).status).toBe(403);
      expect(getYear).not.toHaveBeenCalled();
    });
  });

  describe('404 Response', () => {
    it('maps an absent or out-of-scope fiscal year', async () => {
      getYear.mockRejectedValue(new accountingAppError.FiscalYearNotFound());
      const response = await get();
      expect(response.status).toBe(404);
      expect(response.body.errorKey).toBe(
        'app_error_accounting_fiscal_year_not_found'
      );
    });
  });

  describe('422 Response', () => {
    it('maps invalid fiscal-year IDs to the validation envelope', async () => {
      const errors = [
        {
          field: 'id',
          message: 'accounting_error_period_fiscal_year_id_invalid',
        },
      ];
      getYear.mockRejectedValue(new appError.UnprocessableEntity(errors));
      const response = await request(server)
        .get('/api/v1/accounting/fiscal-years/invalid')
        .set('Authorization', 'Bearer token')
        .set('x-accounting-entity-id', entity.id);
      expect(response.status).toBe(422);
      expect(response.body.errorKey).toBe('app_error_validation_error');
      expect(getYear).toHaveBeenCalledWith('invalid');
    });
  });

  describe('500 Response', () => {
    it('sanitizes read failures', async () => {
      getYear.mockRejectedValue(new Error('database credentials'));
      const response = await get();
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        name: 'InternalServerError',
        errorKey: 'app_error_unexpected',
      });
    });

    it('does not read fiscal years when the entity header is missing', async () => {
      const response = await request(server)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer token');
      expect(response.status).toBe(500);
      expect(getYear).not.toHaveBeenCalled();
    });

    it('does not read fiscal years when the entity header cannot be resolved for the user', async () => {
      findEntity.mockResolvedValue(null);
      expect((await get()).status).toBe(500);
      expect(getYear).not.toHaveBeenCalled();
    });
  });
});
