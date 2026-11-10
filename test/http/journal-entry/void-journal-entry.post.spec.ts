import { Server } from 'node:http';

import request from 'supertest';

import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';
import repoError from '@shared/values/errors/repo.error';

import periodError from '@domain/accounting/errors/period.error';
import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import actorEntity from '@domain/user/entities/actor.entity';
import { IUser } from '@domain/user/types/user.types';

import { mockAccountingEntityRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import mockTokenAppService from '@app/auth/contracts/__mocks__/token-service.mock';
import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag-app.service.mock';
import { mockActorService } from '@app/user/contracts/__mocks__/actor.services.mock';
import { mockUserRepo } from '@app/user/contracts/__mocks__/user.repos.mock';

import { voidJournalEntryUseCase } from '@infra/ioc/usecases/journal-entry';

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
  voidJournalEntryUseCase: jest.fn(),
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
  email: 'journal-void@example.test',
  displayName: 'Journal actor',
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
const endpoint = (id: string = entryId) => `/api/v1/journal-entries/${id}/void`;

describe('POST /journal-entries/{id}/void', () => {
  let server: Server;
  const voidJournalEntry = jest.mocked(voidJournalEntryUseCase);

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
    voidJournalEntry.mockResolvedValue(undefined);
    server = await startTestServer(createApplication());
  });

  afterEach(async () => {
    if (server) {
      await closeTestServer(server);
    }
  });

  const post = (id?: string) =>
    request(server)
      .post(endpoint(id))
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntityId);

  describe('204 Response', () => {
    it('voids the journal using its ID and returns no content', async () => {
      const response = await post();
      expect(response.status).toBe(204);
      expect(response.text).toBe('');
      expect(voidJournalEntry).toHaveBeenCalledWith(entryId);
      expect(voidJournalEntry).toHaveBeenCalledTimes(1);
    });
  });

  describe('400 Response', () => {
    it.each([
      new journalEntryError.InvalidStatusTransition(),
      new journalEntryError.ArchivedLedgerAccountNotAllowed(),
      new journalEntryError.RectificationNotPermitted(),
    ])('returns domain void rejection %j', async (error) => {
      voidJournalEntry.mockRejectedValueOnce(error);
      const response = await post();
      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe(error.errorKey);
    });
  });

  describe('401 Response', () => {
    it('requires authentication', async () => {
      expect((await request(server).post(endpoint())).status).toBe(401);
      expect(voidJournalEntry).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('requires Alpha 1 access', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValueOnce(false);
      expect((await post()).status).toBe(403);
      expect(voidJournalEntry).not.toHaveBeenCalled();
    });

    it('requires accounting entity ownership', async () => {
      mockAccountingEntityRepo.findByIdAndUserId.mockResolvedValue({
        ...accountingEntity,
        ownerId: generateUUID(),
      });
      expect((await post()).status).toBe(403);
      expect(voidJournalEntry).not.toHaveBeenCalled();
    });
  });

  describe('404 Response', () => {
    it.each([
      new journalEntryError.AccountNotFound(),
      new appError.ResourceNotFound(),
    ])('returns missing journal or associated account %j', async (error) => {
      voidJournalEntry.mockRejectedValueOnce(error);
      const response = await post();
      expect(response.status).toBe(404);
      expect(response.body.errorKey).toBe(error.errorKey);
    });
  });

  describe('409 Response', () => {
    it.each([
      new repoError.VersionNotFound(),
      new periodError.PostingPeriodNotOpen(),
    ])('returns conflict %j', async (error) => {
      voidJournalEntry.mockRejectedValueOnce(error);
      const response = await post();
      expect(response.status).toBe(409);
      expect(response.body.errorKey).toBe(error.errorKey);
    });
  });

  describe('422 Response', () => {
    it('returns the invalid ID validation error from the use case', async () => {
      const error = new appError.UnprocessableEntity([
        {
          field: 'id',
          message: new journalEntryError.InvalidJournalEntry().errorKey,
        },
      ]);
      voidJournalEntry.mockRejectedValueOnce(error);

      const response = await post('invalid-id');
      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({
        errorKey: error.errorKey,
        validationErrors: error.validationErrors,
      });
      expect(voidJournalEntry).toHaveBeenCalledWith('invalid-id');
    });
  });

  describe('500 Response', () => {
    it('sanitizes unexpected failures', async () => {
      voidJournalEntry.mockRejectedValueOnce(
        new Error('private persistence details')
      );
      const response = await post();
      expect(response.status).toBe(500);
      expect(JSON.stringify(response.body)).not.toContain(
        'private persistence details'
      );
    });
  });
});
