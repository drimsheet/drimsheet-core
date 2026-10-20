import { Server } from 'node:http';

import { Express } from 'express';
import request from 'supertest';

import generateUUID from '@shared/utils/uuid-generator';

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
jest.mock('@infra/ioc/usecases/ledger', () => ({
  __esModule: true,
  getLedgerAccountCurrencyUpdateEligibilityUseCase: jest.fn(),
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
  email: 'ledger-eligibility@example.test',
  displayName: 'Account reader',
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
const endpoint = `/api/v1/ledger/${accountId}/currency-update-eligibility`;

describe('GET /ledger/{accountId}/currency-update-eligibility', () => {
  let app: Express;
  let server: Server;
  const getEligibility = jest.mocked(
    ledgerUseCases.getLedgerAccountCurrencyUpdateEligibilityUseCase
  );

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
    getEligibility.mockResolvedValue({ canUpdateCurrency: true });
    app = createApplication();
    server = await startTestServer(app);
  });

  afterEach(async () => {
    await closeTestServer(server);
  });

  const getEligibilityResponse = () =>
    request(server)
      .get(endpoint)
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntityId);

  describe('200 Response', () => {
    it.each<
      Awaited<
        ReturnType<
          typeof ledgerUseCases.getLedgerAccountCurrencyUpdateEligibilityUseCase
        >
      >
    >([
      { canUpdateCurrency: true },
      { canUpdateCurrency: false, reason: 'not_asset_account' },
      { canUpdateCurrency: false, reason: 'has_posted_journal_entries' },
    ])('returns eligibility %p', async (eligibility) => {
      getEligibility.mockResolvedValue(eligibility);
      const response = await getEligibilityResponse();
      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.body).toEqual(eligibility);
      expect(getEligibility).toHaveBeenCalledWith(accountId);
    });
  });
  describe('400 Response', () => {
    it('maps an invalid account ID', async () => {
      getEligibility.mockRejectedValueOnce(new ledgerAccountError.InvalidId());
      const response = await request(server)
        .get('/api/v1/ledger/invalid-id/currency-update-eligibility')
        .set('Authorization', 'Bearer valid-token')
        .set('x-accounting-entity-id', accountingEntityId);
      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe('ledger_error_id_invalid');
    });
  });
  describe('401 Response', () => {
    it('requires authentication before orchestration', async () => {
      expect((await request(server).get(endpoint)).status).toBe(401);
      expect(getEligibility).not.toHaveBeenCalled();
    });
  });
  describe('403 Response', () => {
    it('requires Alpha 1 access', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValueOnce(false);
      expect((await getEligibilityResponse()).status).toBe(403);
      expect(getEligibility).not.toHaveBeenCalled();
    });
    it('requires accounting entity ownership', async () => {
      mockAccountingEntityRepo.findByIdAndUserId.mockResolvedValue({
        ...accountingEntity,
        ownerId: generateUUID(),
      });
      expect((await getEligibilityResponse()).status).toBe(403);
      expect(getEligibility).not.toHaveBeenCalled();
    });
  });
  describe('404 Response', () => {
    it('maps accounts absent from the current entity to not found', async () => {
      getEligibility.mockRejectedValueOnce(
        new ledgerAccountError.AccountNotFound()
      );
      const response = await getEligibilityResponse();
      expect(response.status).toBe(404);
      expect(response.body.errorKey).toBe(
        'ledger_error_ledger_account_not_found'
      );
    });
  });
  describe('500 Response', () => {
    it('sanitizes query failures', async () => {
      getEligibility.mockRejectedValueOnce(new Error('private query details'));
      const response = await getEligibilityResponse();
      expect(response.status).toBe(500);
      expect(JSON.stringify(response.body)).not.toContain(
        'private query details'
      );
    });
  });
});
