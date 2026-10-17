import { Express } from 'express';
import request from 'supertest';

import mockReporter from '@shared/contracts/__mocks__/reporter.mock';
import generateUUID from '@shared/utils/uuid-generator';
import repoError from '@shared/values/errors/repo.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import actorEntity from '@domain/user/entities/actor.entity';
import { IUser } from '@domain/user/types/user.types';

import { mockAccountingEntityRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import mockTokenAppService from '@app/auth/contracts/__mocks__/token-service.mock';
import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag-app.service.mock';
import { mockActorService } from '@app/user/contracts/__mocks__/actor.services.mock';
import { mockUserRepo } from '@app/user/contracts/__mocks__/user.repos.mock';

import * as ledgerUseCases from '@infra/ioc/usecases/ledger';
import { createApplication } from '@infra/server';

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
jest.mock('@infra/ioc/usecases/ledger', () => ({
  __esModule: true,
  deleteLedgerAccountUseCase: jest.fn(),
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
  email: 'ledger-delete@example.test',
  displayName: 'Deleter',
});
const userId = generateUUID();
const accountingEntityId = generateUUID();
const accountId = generateUUID();
const accountingEntity = {
  id: accountingEntityId,
  createdBy: actor.id,
  ownerId: userId,
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
} as IAccountingEntity;
const endpoint = `/api/v1/ledger/${accountId}`;

describe('DELETE /ledger/{accountId}', () => {
  let app: Express;
  const remove = jest.mocked(ledgerUseCases.deleteLedgerAccountUseCase);

  beforeEach(() => {
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
    remove.mockResolvedValue(undefined);
    app = createApplication();
  });

  const deleteAccount = () =>
    request(app)
      .delete(endpoint)
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntityId);

  describe('204 Response', () => {
    it('deletes by ID with no request body or response content', async () => {
      const response = await deleteAccount();
      expect(response.status).toBe(204);
      expect(response.text).toBe('');
      expect(remove).toHaveBeenCalledWith(accountId);
    });
  });
  describe('400 Response', () => {
    it.each([
      [
        ledgerAccountError.HeaderAccountNotDeletable,
        'ledger_error_header_account_delete_invalid',
      ],
      [
        ledgerAccountError.NonDraftAccountDeletion,
        'ledger_error_non_draft_account_deletion_invalid',
      ],
      [ledgerAccountError.InvalidId, 'ledger_error_id_invalid'],
    ])('maps deletion rejection %p', async (ErrorClass, errorKey) => {
      remove.mockRejectedValueOnce(new ErrorClass());
      const response = await deleteAccount();
      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe(errorKey);
    });
  });
  describe('401 Response', () => {
    it('requires authentication before orchestration', async () => {
      expect((await request(app).delete(endpoint)).status).toBe(401);
      expect(remove).not.toHaveBeenCalled();
    });
  });
  describe('403 Response', () => {
    it('requires Alpha 1 access', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValueOnce(false);
      expect((await deleteAccount()).status).toBe(403);
      expect(remove).not.toHaveBeenCalled();
    });
    it('requires accounting entity ownership', async () => {
      mockAccountingEntityRepo.findByIdAndUserId.mockResolvedValue({
        ...accountingEntity,
        ownerId: generateUUID(),
      });
      expect((await deleteAccount()).status).toBe(403);
      expect(remove).not.toHaveBeenCalled();
    });
  });
  describe('404 Response', () => {
    it('maps accounts absent from the current entity to not found', async () => {
      remove.mockRejectedValueOnce(new ledgerAccountError.AccountNotFound());
      const response = await deleteAccount();
      expect(response.status).toBe(404);
      expect(response.body.errorKey).toBe(
        'ledger_error_ledger_account_not_found'
      );
    });
  });
  describe('409 Response', () => {
    it('reports concurrent changes', async () => {
      remove.mockRejectedValueOnce(new repoError.VersionNotFound());
      expect((await deleteAccount()).status).toBe(409);
    });
  });
  describe('500 Response', () => {
    it('treats a non-draft journal on a draft account as an internal invariant failure', async () => {
      const error = new ledgerAccountError.InvalidDraftAccountJournalEntry();
      remove.mockRejectedValueOnce(error);
      const response = await deleteAccount();
      expect(response.status).toBe(500);
      expect(response.body.errorKey).toBe('app_error_unexpected');
      expect(mockReporter.report).toHaveBeenCalledWith(
        'http.request.failed',
        error
      );
    });
    it('sanitizes persistence failures', async () => {
      remove.mockRejectedValueOnce(new Error('private persistence details'));
      const response = await deleteAccount();
      expect(response.status).toBe(500);
      expect(JSON.stringify(response.body)).not.toContain(
        'private persistence details'
      );
    });
  });
});
