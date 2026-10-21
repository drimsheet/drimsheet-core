import { Server } from 'node:http';

import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';

import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import periodError from '@domain/accounting/errors/period.error';
import { IUser } from '@domain/user/types/user.types';

import accountingAppError from '@app/accounting/errors/accounting.error';
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

jest.mock('../../../src/infra/ioc/services/auth', () => ({
  __esModule: true,
  tokenAppService: { getAuthUser: jest.fn() },
}));

jest.mock('../../../src/infra/ioc/usecases/accounting', () => ({
  __esModule: true,
  createFiscalYearUseCase: jest.fn(),
  getJurisdictionsUseCase: jest.fn(),
  getUserAccountingEntitiesUseCase: jest.fn(),
  getActiveAccountingEntityUseCase: jest.fn(),
}));

jest.mock('../../../src/infra/persistence/repos/accounting', () => ({
  __esModule: true,
  default: {
    accountingEntity: {
      findByIdAndUserId: jest.fn(),
    },
  },
}));

jest.mock('../../../src/infra/persistence/repos/user', () => ({
  __esModule: true,
  default: {
    user: {
      findById: jest.fn(),
    },
  },
}));

const ENDPOINT = '/api/v1/accounting/fiscal-year';
const userId = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
const accountingEntityId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const payload = {
  accountingEntityId,
  name: 'FY 2090',
  startDate: '2090-01-01T00:00:00.000Z',
  endDate: '2090-12-31T00:00:00.000Z',
  status: 'open',
};
const year = {
  id: '123e4567-e89b-12d3-a456-426614174002' as TEntityId,
  createdBy: userId,
  name: payload.name,
  accountingEntityId,
  startDate: new Date(payload.startDate),
  endDate: new Date(payload.endDate),
  status: 'open',
  closedAt: null,
  updatedAt: new Date('2090-01-01'),
};

describe('POST /accounting/fiscal-year', () => {
  let app: Express;
  let server: Server;
  const create = jest.mocked(accountingUsecases.createFiscalYearUseCase);
  beforeEach(async () => {
    jest.resetAllMocks();
    mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(true);
    (tokenAppService.getAuthUser as jest.Mock).mockResolvedValue({
      id: userId,
    });
    (userRepos.user.findById as jest.Mock).mockResolvedValue({
      id: userId,
      actorId: userId,
      createdBy: userId,
    } as IUser);
    (
      accountingRepos.accountingEntity.findByIdAndUserId as jest.Mock
    ).mockResolvedValue(null);
    create.mockResolvedValue({ ...year, status: 'open' });
    app = createApplication();
    server = await startTestServer(app);
  });

  afterEach(async () => {
    await closeTestServer(server);
  });

  describe('201 Response', () => {
    it('accepts an explicit entity without an active-entity header and returns only the fiscal year', async () => {
      const response = await request(server)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer token')
        .send(payload);
      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        ...year,
        startDate: year.startDate.toISOString(),
        endDate: year.endDate.toISOString(),
        updatedAt: year.updatedAt.toISOString(),
      });
      expect(create).toHaveBeenCalledWith({
        ...payload,
        startDate: year.startDate,
        endDate: year.endDate,
      });
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });
  describe('400 Response', () => {
    it.each([
      periodError.InvalidDateRange,
      periodError.FiscalYearExceedsJurisdictionLimit,
    ])('maps domain date rejection', async (ErrorType) => {
      const error = new ErrorType();
      create.mockRejectedValue(error);
      const response = await request(server)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer token')
        .send(payload);
      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe(error.errorKey);
    });
  });
  describe('401 Response', () => {
    it('requires authentication', async () => {
      const response = await request(server).post(ENDPOINT).send(payload);
      expect(response.status).toBe(401);
      expect(create).not.toHaveBeenCalled();
    });
  });
  describe('403 Response', () => {
    it('maps inaccessible entity errors', async () => {
      const error = new accountingEntityError.Unauthorized();
      create.mockRejectedValue(error);
      const response = await request(server)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer token')
        .send(payload);
      expect(response.status).toBe(403);
      expect(response.body.errorKey).toBe(error.errorKey);
    });
    it('checks feature access before orchestration', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(false);
      const response = await request(server)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer token')
        .send(payload);
      expect(response.status).toBe(403);
      expect(create).not.toHaveBeenCalled();
    });
  });
  describe('404 Response', () => {
    it('maps a missing entity', async () => {
      create.mockRejectedValue(new accountingAppError.EntityNotFound());
      const response = await request(server)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer token')
        .send(payload);
      expect(response.status).toBe(404);
      expect(response.body.errorKey).toBe(
        'app_error_accounting_entity_not_found'
      );
    });
  });
  describe('409 Response', () => {
    it('maps overlapping fiscal years', async () => {
      create.mockRejectedValue(new periodError.OverlappingFiscalYears());
      const response = await request(server)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer token')
        .send(payload);
      expect(response.status).toBe(409);
      expect(response.body.errorKey).toBe(
        'accounting_error_period_fiscal_year_overlap_conflict'
      );
    });
  });
  describe('422 Response', () => {
    it.each([
      { startDate: 'invalid' },
      { status: 'invalid' },
      { accountingEntityId: undefined },
      { createdBy: userId },
    ])('rejects malformed payload before orchestration: %j', async (change) => {
      const response = await request(server)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer token')
        .send({ ...payload, ...change });
      expect(response.status).toBe(422);
      expect(create).not.toHaveBeenCalled();
    });
  });
  describe('500 Response', () => {
    it('sanitizes unexpected failures', async () => {
      create.mockRejectedValue(new Error('private database detail'));
      const response = await request(server)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer token')
        .send(payload);
      expect(response.status).toBe(500);
      expect(JSON.stringify(response.body)).not.toContain(
        'private database detail'
      );
    });
  });
});
