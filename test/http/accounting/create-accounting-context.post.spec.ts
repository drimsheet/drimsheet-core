import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import accountingStandardError from '@domain/accounting/errors/accounting-standard.error';
import accountingError from '@domain/accounting/errors/accounting.error';
import { IUser } from '@domain/user/types/user.types';

import accountingAppError from '@app/accounting/errors/accounting.error';
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
  createAccountingContextUseCase: jest.fn(),
  onboardAccountingEntityUseCase: jest.fn(),
  getJurisdictionsUseCase: jest.fn(),
  getUserAccountingEntitiesUseCase: jest.fn(),
  getActiveAccountingEntityUseCase: jest.fn(),
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

const ENDPOINT = '/api/v1/accounting/accounting-context';
const userId = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
const [entity] = accountingEntityEntity.make({
  createdBy: userId,
  ownerId: userId,
  name: 'Business',
  type: 'private_company',
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
});
const accountingEntityId = entity.id;
const payload = {
  name: 'Working context',
  description: null,
  fiscalYearId: '123e4567-e89b-12d3-a456-426614174002',
  currentAccountingPeriodId: '123e4567-e89b-12d3-a456-426614174003',
  accountingStandardCode: 'IFRS' as const,
};
const context = {
  ...payload,
  accountingEntityId,
  id: '123e4567-e89b-12d3-a456-426614174004',
  createdBy: userId,
  createdAt: new Date('2026-10-17'),
  updatedAt: new Date('2026-10-17'),
  closedAt: null,
};

describe('POST /accounting/accounting-context', () => {
  let app: Express;
  const create = jest.mocked(accountingUsecases.createAccountingContextUseCase);
  beforeEach(() => {
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
    ).mockResolvedValue(entity);
    create.mockResolvedValue(context);
    app = createApplication();
  });

  describe('201 Response', () => {
    it('uses the entity header and returns only the created context', async () => {
      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer token')
        .set('x-accounting-entity-id', accountingEntityId)
        .send(payload);
      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        ...context,
        createdAt: context.createdAt.toISOString(),
        updatedAt: context.updatedAt.toISOString(),
      });
      expect(create).toHaveBeenCalledWith(payload);
      expect(
        accountingRepos.accountingEntity.findByIdAndUserId
      ).toHaveBeenCalledWith(accountingEntityId, userId, expect.any(Object));
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });
  describe('400 Response', () => {
    it.each([
      accountingError.InvalidFiscalYearId,
      accountingError.InvalidCurrentAccountingPeriodId,
      accountingStandardError.Invalid,
    ])('maps invalid references and standards', async (ErrorType) => {
      const error = new ErrorType();
      create.mockRejectedValue(error);
      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer token')
        .set('x-accounting-entity-id', accountingEntityId)
        .send(payload);
      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe(error.errorKey);
    });
  });
  describe('401 Response', () => {
    it('requires authentication', async () => {
      const response = await request(app).post(ENDPOINT).send(payload);
      expect(response.status).toBe(401);
      expect(create).not.toHaveBeenCalled();
    });
  });
  describe('403 Response', () => {
    it('rejects an inaccessible entity before orchestration', async () => {
      jest
        .mocked(accountingRepos.accountingEntity.findByIdAndUserId)
        .mockResolvedValue({
          ...entity,
          ownerId: '123e4567-e89b-12d3-a456-426614174099' as TEntityId,
        });
      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer token')
        .set('x-accounting-entity-id', accountingEntityId)
        .send(payload);
      expect(response.status).toBe(403);
      expect(create).not.toHaveBeenCalled();
    });
    it('checks feature access before orchestration', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(false);
      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer token')
        .set('x-accounting-entity-id', accountingEntityId)
        .send(payload);
      expect(response.status).toBe(403);
      expect(create).not.toHaveBeenCalled();
    });
  });
  describe('404 Response', () => {
    it.each([
      accountingAppError.FiscalYearNotFound,
      accountingAppError.AccountingPeriodNotFound,
    ])('maps missing prerequisites', async (ErrorType) => {
      const error = new ErrorType();
      create.mockRejectedValue(error);
      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer token')
        .set('x-accounting-entity-id', accountingEntityId)
        .send(payload);
      expect(response.status).toBe(404);
      expect(response.body.errorKey).toBe(error.errorKey);
    });
  });
  describe('409 Response', () => {
    it('maps archived accounting entity rejection', async () => {
      const error = new accountingEntityError.Archived();
      create.mockRejectedValue(error);
      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer token')
        .set('x-accounting-entity-id', accountingEntityId)
        .send(payload);
      expect(response.status).toBe(409);
      expect(response.body.errorKey).toBe(error.errorKey);
    });
  });
  describe('422 Response', () => {
    it.each([
      { accountingStandardCode: 'INVALID' },
      { currentAccountingPeriodId: undefined },
      { fiscalYearId: undefined },
      { description: 42 },
      { accountingEntityId },
      { createdBy: userId },
    ])('rejects malformed payload before orchestration: %j', async (change) => {
      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer token')
        .set('x-accounting-entity-id', accountingEntityId)
        .send({ ...payload, ...change });
      expect(response.status).toBe(422);
      expect(create).not.toHaveBeenCalled();
    });
  });
  describe('500 Response', () => {
    it('requires an entity header before orchestration', async () => {
      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer token')
        .send(payload);
      expect(response.status).toBe(500);
      expect(create).not.toHaveBeenCalled();
    });
    it('rejects an entity header that cannot be resolved for the user', async () => {
      jest
        .mocked(accountingRepos.accountingEntity.findByIdAndUserId)
        .mockResolvedValue(null);
      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer token')
        .set('x-accounting-entity-id', accountingEntityId)
        .send(payload);
      expect(response.status).toBe(500);
      expect(create).not.toHaveBeenCalled();
    });
    it('sanitizes unexpected failures', async () => {
      create.mockRejectedValue(new Error('private database detail'));
      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer token')
        .set('x-accounting-entity-id', accountingEntityId)
        .send(payload);
      expect(response.status).toBe(500);
      expect(JSON.stringify(response.body)).not.toContain(
        'private database detail'
      );
    });
  });
});
