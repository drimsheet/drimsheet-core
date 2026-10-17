import { Express } from 'express';
import request from 'supertest';

import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';
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
  activateCashAccountUseCase: jest.fn(),
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
  email: 'ledger-activate@example.test',
  displayName: 'Activator',
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
const endpoint = `/api/v1/ledger/asset/cash/${accountId}/activate`;

describe('POST /ledger/asset/cash/{accountId}/activate', () => {
  let app: Express;
  const activation = jest.mocked(ledgerUseCases.activateCashAccountUseCase);

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
    activation.mockResolvedValue(undefined);
    app = createApplication();
  });

  const post = (payload = { activateOpeningBalance: true }) =>
    request(app)
      .post(endpoint)
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntityId)
      .send(payload);

  describe('204 Response', () => {
    it.each([true, false])(
      'passes the account ID and activation flag %s to the use case',
      async (activateOpeningBalance) => {
        const payload = { activateOpeningBalance };
        const response = await post(payload);

        expect(response.status).toBe(204);
        expect(response.text).toBe('');
        expect(activation).toHaveBeenCalledWith(accountId, payload);
      }
    );
  });

  describe('400 Response', () => {
    it('returns 400 for a rejected activation request', async () => {
      activation.mockRejectedValueOnce(new ledgerAccountError.InvalidStatus());

      const response = await post();

      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe(
        'ledger_error_ledger_account_status_invalid'
      );
    });
  });

  describe('401 Response', () => {
    it('rejects unauthenticated callers before the use case', async () => {
      const response = await request(app).post(endpoint);

      expect(response.status).toBe(401);
      expect(activation).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('requires Alpha 1 access', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValueOnce(false);

      const response = await post();

      expect(response.status).toBe(403);
      expect(activation).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('requires accounting entity ownership', async () => {
      mockAccountingEntityRepo.findByIdAndUserId.mockResolvedValue({
        ...accountingEntity,
        ownerId: generateUUID(),
      });

      const response = await post();

      expect(response.status).toBe(403);
      expect(activation).not.toHaveBeenCalled();
    });
  });

  describe('404 Response', () => {
    it('returns 404 when the activation use case cannot find the account', async () => {
      activation.mockRejectedValueOnce(
        new ledgerAccountError.AccountNotFound()
      );

      const response = await post();

      expect(response.status).toBe(404);
      expect(response.body.errorKey).toBe(
        'ledger_error_ledger_account_not_found'
      );
    });
  });

  describe('409 Response', () => {
    it('returns 409 for a concurrent write conflict', async () => {
      activation.mockRejectedValueOnce(new repoError.VersionNotFound());

      expect((await post()).status).toBe(409);
    });
  });

  describe('422 Response', () => {
    it.each([
      undefined,
      {},
      { activateOpeningBalance: 'invalid' },
      { activateOpeningBalance: 1 },
      { activateOpeningBalance: true, expectedVersion: 1 },
    ])('rejects invalid input %j before the use case', async (payload) => {
      const pending = request(app)
        .post(endpoint)
        .set('Authorization', 'Bearer valid-token')
        .set('x-accounting-entity-id', accountingEntityId);
      const response = await (payload === undefined
        ? pending
        : pending.send(payload));

      expect(response.status).toBe(422);
      expect(response.body.errorKey).toBe('app_error_validation_error');
      expect(activation).not.toHaveBeenCalled();
    });

    it('returns application validation errors from the use case', async () => {
      const validationErrors = [
        {
          field: 'activateOpeningBalance',
          message: 'app_error_ledger_activate_opening_balance_invalid',
        },
      ];
      activation.mockRejectedValueOnce(
        new appError.UnprocessableEntity(validationErrors)
      );

      const response = await post();

      expect(response.status).toBe(422);
      expect(response.body.errorKey).toBe('app_error_validation_error');
      expect(response.body.validationErrors).toEqual(validationErrors);
    });
  });

  describe('500 Response', () => {
    it('sanitizes unexpected failures', async () => {
      activation.mockRejectedValueOnce(
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
