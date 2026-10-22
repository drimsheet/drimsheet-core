import { Server } from 'node:http';

import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import reportingIntervalEntity from '@domain/accounting/entities/reporting-interval.entity';
import accountingError from '@domain/accounting/errors/accounting.error';
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

jest.mock('@infra/ioc/services/accounting', () => ({
  accountingEntityService: jest
    .requireActual<
      typeof import('@domain/accounting/services/accounting-entity.service')
    >('@domain/accounting/services/accounting-entity.service')
    .default({
      accountingEntityRepo: jest.requireActual<
        typeof import('@app/accounting/contracts/__mocks__/accounting.repos.mock')
      >('@app/accounting/contracts/__mocks__/accounting.repos.mock')
        .mockAccountingEntityRepo,
      ledgerAccountBalanceRepo: jest.requireActual<
        typeof import('@app/ledger/contracts/__mocks__/ledger.repos.mock')
      >('@app/ledger/contracts/__mocks__/ledger.repos.mock')
        .mockLedgerAccountBalanceRepo,
      journalEntryRepo: jest.requireActual<
        typeof import('@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock')
      >('@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock')
        .mockJournalEntryRepo,
    }),
}));

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
  createReportingIntervalUseCase: jest.fn(),
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

const ENDPOINT = '/api/v1/accounting/reporting-intervals';
const userId = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
const [entity] = accountingEntityEntity.make({
  createdBy: userId,
  ownerId: userId,
  name: 'Business',
  type: 'sole_trader',
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
});
const accountingEntityId = entity.id;
const payload = {
  fiscalYearId: '123e4567-e89b-12d3-a456-426614174002' as TEntityId,
  unit: 'month' as const,
  count: 12,
  periods: Array.from({ length: 12 }, (_, index) => ({
    name: `Month ${index + 1}`,
  })),
};
const [interval] = reportingIntervalEntity.make(
  {
    ...payload,
    accountingEntityId,
    createdBy: userId,
    startDate: new Date('2090-01-01'),
    endDate: new Date('2091-01-01'),
  },
  new Date('2090-01-01')
);

describe('POST /accounting/reporting-intervals', () => {
  let app: Express;
  let server: Server;
  const create = jest.mocked(accountingUsecases.createReportingIntervalUseCase);
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
    ).mockResolvedValue(entity);
    create.mockResolvedValue(interval);
    app = createApplication();
    server = await startTestServer(app);
  });

  afterEach(async () => {
    await closeTestServer(server);
  });

  describe('201 Response', () => {
    it('uses the entity header and returns the created interval and periods', async () => {
      const response = await request(server)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer token')
        .set('x-accounting-entity-id', accountingEntityId)
        .send(payload);
      expect(response.status).toBe(201);
      expect(response.body).toEqual(
        JSON.parse(JSON.stringify(interval)) as unknown
      );
      expect(create).toHaveBeenCalledWith(payload);
      expect(
        accountingRepos.accountingEntity.findByIdAndUserId
      ).toHaveBeenCalledWith(accountingEntityId, userId, expect.any(Object));
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });
  describe('400 Response', () => {
    it.each([
      periodError.InvalidInterval,
      periodError.InvalidAccountingEntityId,
    ])('maps domain generation or ownership rejection', async (ErrorType) => {
      const error = new ErrorType();
      create.mockRejectedValue(error);
      const response = await request(server)
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
      const response = await request(server).post(ENDPOINT).send(payload);
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
      const response = await request(server)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer token')
        .set('x-accounting-entity-id', accountingEntityId)
        .send(payload);
      expect(response.status).toBe(403);
      expect(create).not.toHaveBeenCalled();
    });
    it('checks feature access before orchestration', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(false);
      const response = await request(server)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer token')
        .set('x-accounting-entity-id', accountingEntityId)
        .send(payload);
      expect(response.status).toBe(403);
      expect(create).not.toHaveBeenCalled();
    });
  });
  describe('404 Response', () => {
    it.each([accountingAppError.FiscalYearNotFound])(
      'maps a missing fiscal year',
      async (ErrorType) => {
        const error = new ErrorType();
        create.mockRejectedValue(error);
        const response = await request(server)
          .post(ENDPOINT)
          .set('Authorization', 'Bearer token')
          .set('x-accounting-entity-id', accountingEntityId)
          .send(payload);
        expect(response.status).toBe(404);
        expect(response.body.errorKey).toBe(error.errorKey);
      }
    );
  });
  describe('409 Response', () => {
    it('rejects a second reporting interval for the fiscal year', async () => {
      const error = new accountingError.ReportingIntervalAlreadyExists();
      create.mockRejectedValue(error);
      const response = await request(server)
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
      { unit: 'invalid' },
      { count: 'invalid' },
      { fiscalYearId: undefined },
      { accountingEntityId },
      { createdBy: userId },
      { periods: undefined },
      { periods: {} },
      { periods: [{}] },
      { periods: [{ name: 'January', startDate: '2090-01-01' }] },
    ])('rejects malformed payload before orchestration: %j', async (change) => {
      const response = await request(server)
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
      const response = await request(server)
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
      const response = await request(server)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer token')
        .set('x-accounting-entity-id', accountingEntityId)
        .send(payload);
      expect(response.status).toBe(500);
      expect(create).not.toHaveBeenCalled();
    });

    it('sanitizes unexpected failures', async () => {
      create.mockRejectedValue(new Error('private database detail'));
      const response = await request(server)
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
