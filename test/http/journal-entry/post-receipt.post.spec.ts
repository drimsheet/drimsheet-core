import { Server } from 'node:http';

import { Express } from 'express';
import request from 'supertest';

import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';
import repoError from '@shared/values/errors/repo.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import actorEntity from '@domain/user/entities/actor.entity';
import { IUser } from '@domain/user/types/user.types';

import { mockAccountingEntityRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import mockTokenAppService from '@app/auth/contracts/__mocks__/token-service.mock';
import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag-app.service.mock';
import { mockActorService } from '@app/user/contracts/__mocks__/actor.services.mock';
import { mockUserRepo } from '@app/user/contracts/__mocks__/user.repos.mock';

import * as journalEntryUseCases from '@infra/ioc/usecases/journal-entry';

import createApplication from '@interface/http/application';

import { closeTestServer, startTestServer } from '../../setup/http-listener';

jest.mock('@infra/ioc/handlers/http', () => {
  const makeHttpErrorHandler = jest.requireActual<
    typeof import('@interface/http/handlers/error.handler')
  >('@interface/http/handlers/error.handler').default;
  const makeHealthHandlers = jest.requireActual<
    typeof import('@interface/http/handlers/health.handler')
  >('@interface/http/handlers/health.handler').default;
  const logger = jest.requireActual<
    typeof import('@shared/contracts/__mocks__/logger.mock')
  >('@shared/contracts/__mocks__/logger.mock').default;
  const reporter = jest.requireActual<
    typeof import('@shared/contracts/__mocks__/reporter.mock')
  >('@shared/contracts/__mocks__/reporter.mock').default;

  return {
    __esModule: true,
    default: {
      error: makeHttpErrorHandler({ logger, reporter, nodeEnv: 'test' }),
    },
    healthHandlers: makeHealthHandlers({ isReady: async () => true }),
    mcpRouteHandler: jest.fn(),
  };
});
jest.mock('@infra/ioc/services/user', () => ({
  __esModule: true,
  actorService: jest.requireActual<
    typeof import('@app/user/contracts/__mocks__/actor.services.mock')
  >('@app/user/contracts/__mocks__/actor.services.mock').mockActorService,
}));
jest.mock('@infra/ioc/services/context', () => ({
  __esModule: true,
  featureFlagAppService: jest.requireActual<
    typeof import('@app/context/contracts/__mocks__/feature-flag-app.service.mock')
  >('@app/context/contracts/__mocks__/feature-flag-app.service.mock').default,
}));
jest.mock('@infra/ioc/services/auth', () => ({
  __esModule: true,
  tokenAppService: jest.requireActual<
    typeof import('@app/auth/contracts/__mocks__/token-service.mock')
  >('@app/auth/contracts/__mocks__/token-service.mock').default,
}));
jest.mock('@infra/ioc/usecases/auth', () => ({
  __esModule: true,
  oAuthUseCase: { handleGoogleCallback: jest.fn() },
}));
jest.mock('@infra/ioc/usecases/journal-entry', () => ({
  __esModule: true,
  postDraftReceiptUseCase: jest.fn(),
  getJournalEntryUseCase: jest.fn(),
  archiveJournalEntryUseCase: jest.fn(),
}));
jest.mock('@infra/persistence/repos/accounting', () => ({
  __esModule: true,
  default: {
    accountingEntity: jest.requireActual<
      typeof import('@app/accounting/contracts/__mocks__/accounting.repos.mock')
    >('@app/accounting/contracts/__mocks__/accounting.repos.mock')
      .mockAccountingEntityRepo,
  },
}));
jest.mock('@infra/persistence/repos/user', () => ({
  __esModule: true,
  default: {
    user: jest.requireActual<
      typeof import('@app/user/contracts/__mocks__/user.repos.mock')
    >('@app/user/contracts/__mocks__/user.repos.mock').mockUserRepo,
  },
}));
jest.mock('@interface/http/routes/bull.route', () => ({
  __esModule: true,
  default: jest.requireActual<typeof import('express')>('express').Router(),
}));

const [actor] = actorEntity.makeUser({
  email: 'receipt-post@example.test',
  displayName: 'Poster',
});
const userId = generateUUID();
const accountingEntityId = generateUUID();
const entryId = generateUUID();
const accountingEntity = {
  id: accountingEntityId,
  createdBy: actor.id,
  ownerId: userId,
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
} as IAccountingEntity;
const endpoint = `/api/v1/journal-entries/receipt/${entryId}/post`;

describe('POST /journal-entries/receipt/{id}/post', () => {
  let app: Express;
  let server: Server;
  const posting = jest.mocked(journalEntryUseCases.postDraftReceiptUseCase);

  beforeEach(async () => {
    jest.resetAllMocks();
    mockActorService.resolveUser.mockResolvedValue(actor);
    mockTokenAppService.getAuthUser.mockResolvedValue({ id: userId });
    mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(true);
    mockUserRepo.findById.mockResolvedValue({
      id: userId,
      actorId: actor.id,
      createdBy: actor.id,
    } as IUser);
    mockAccountingEntityRepo.findByIdAndUserId.mockResolvedValue(
      accountingEntity
    );
    posting.mockResolvedValue(undefined);
    app = createApplication();
    server = await startTestServer(app);
  });

  afterEach(async () => {
    await closeTestServer(server);
  });

  const post = () =>
    request(server)
      .post(endpoint)
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntityId);

  describe('204 Response', () => {
    it('posts the receipt with the journal-entry ID and no body', async () => {
      const response = await post();
      expect(response.status).toBe(204);
      expect(response.text).toBe('');
      expect(posting).toHaveBeenCalledWith(entryId);
      expect(posting).toHaveBeenCalledTimes(1);
    });
  });

  describe('400 Response', () => {
    it.each([
      new journalEntryError.DraftLedgerAccountNotAllowed(),
      new journalEntryError.ArchivedLedgerAccountNotAllowed(),
      new journalEntryError.RectificationNotPermitted(),
    ])('returns domain posting rejection %j', async (error) => {
      posting.mockRejectedValueOnce(error);
      const response = await post();
      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe(error.errorKey);
    });
  });

  describe('401 Response', () => {
    it('requires authentication', async () => {
      expect((await request(server).post(endpoint)).status).toBe(401);
      expect(posting).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('requires Alpha 1 access', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValueOnce(false);
      expect((await post()).status).toBe(403);
      expect(posting).not.toHaveBeenCalled();
    });

    it('requires accounting entity ownership', async () => {
      mockAccountingEntityRepo.findByIdAndUserId.mockResolvedValue({
        ...accountingEntity,
        ownerId: generateUUID(),
      });
      expect((await post()).status).toBe(403);
      expect(posting).not.toHaveBeenCalled();
    });
  });

  describe('404 Response', () => {
    it.each([
      new journalEntryError.AccountNotFound(),
      new appError.ResourceNotFound(),
    ])('returns missing journal or associated account %j', async (error) => {
      posting.mockRejectedValueOnce(error);
      const response = await post();
      expect(response.status).toBe(404);
      expect(response.body.errorKey).toBe(error.errorKey);
    });
  });

  describe('409 Response', () => {
    it('returns a conflict for concurrent journal updates', async () => {
      posting.mockRejectedValueOnce(new repoError.VersionNotFound());
      expect((await post()).status).toBe(409);
    });
  });

  describe('500 Response', () => {
    it('sanitizes unexpected failures', async () => {
      posting.mockRejectedValueOnce(new Error('private persistence details'));
      const response = await post();
      expect(response.status).toBe(500);
      expect(JSON.stringify(response.body)).not.toContain(
        'private persistence details'
      );
    });
  });
});
