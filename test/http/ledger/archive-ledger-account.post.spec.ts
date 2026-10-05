import { Express } from 'express';
import request from 'supertest';

import generateUUID from '@shared/utils/uuid-generator';
import repoError from '@shared/values/errors/repo.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import actorEntity from '@domain/user/entities/actor.entity';
import { IUser } from '@domain/user/types/user.types';

import { mockAccountingEntityRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import mockTokenService from '@app/auth/contracts/__mocks__/token-service.mock';
import mockFeatureFlagService from '@app/context/contracts/__mocks__/feature-flag.service.mock';
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
jest.mock(
  '@infra/integrations/launchdarkly/launchdarkly-feature-flag.service',
  () => ({
    __esModule: true,
    default: jest.requireActual<
      typeof import('@app/context/contracts/__mocks__/feature-flag.service.mock')
    >('@app/context/contracts/__mocks__/feature-flag.service.mock').default,
  })
);
jest.mock('@infra/ioc/services/auth', () => ({
  __esModule: true,
  tokenService: jest.requireActual<
    typeof import('@app/auth/contracts/__mocks__/token-service.mock')
  >('@app/auth/contracts/__mocks__/token-service.mock').default,
}));
jest.mock('@infra/ioc/usecases/auth', () => ({
  __esModule: true,
  oAuthUseCase: { handleGoogleCallback: jest.fn() },
}));
jest.mock('@infra/ioc/usecases/ledger', () => ({
  __esModule: true,
  archiveLedgerAccountUseCase: jest.fn(),
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
  email: 'ledger-archive@example.test',
  displayName: 'Archiver',
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
const endpoint = `/api/v1/ledger/${accountId}/archive`;

describe('POST /ledger/{accountId}/archive', () => {
  let app: Express;
  const archive = jest.mocked(ledgerUseCases.archiveLedgerAccountUseCase);

  beforeEach(() => {
    jest.resetAllMocks();
    mockActorService.resolveUser.mockResolvedValue(actor);
    mockTokenService.getAuthUser.mockResolvedValue({ id: userId });
    mockFeatureFlagService.canAccessAlpha1.mockResolvedValue(true);
    mockUserRepo.findById.mockResolvedValue({
      id: userId,
      actorId: actor.id,
      createdBy: actor.id,
    } as IUser);
    mockAccountingEntityRepo.findByIdAndUserId.mockResolvedValue(
      accountingEntity
    );
    archive.mockResolvedValue(undefined);
    app = createApplication();
  });

  const post = () =>
    request(app)
      .post(endpoint)
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntityId);

  it('returns 204 and passes the account ID to the archive use case', async () => {
    const response = await post();

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(archive).toHaveBeenCalledWith(accountId);
  });

  it('returns 400 for a rejected archive request', async () => {
    archive.mockRejectedValueOnce(
      new ledgerAccountError.HeaderAccountNotArchivable()
    );

    const response = await post();

    expect(response.status).toBe(400);
    expect(response.body.errorKey).toBe(
      'ledger_error_header_account_archive_invalid'
    );
  });

  it('rejects unauthenticated callers before the use case', async () => {
    const response = await request(app).post(endpoint);

    expect(response.status).toBe(401);
    expect(archive).not.toHaveBeenCalled();
  });

  it('requires Alpha 1 access', async () => {
    mockFeatureFlagService.canAccessAlpha1.mockResolvedValueOnce(false);

    const response = await post();

    expect(response.status).toBe(403);
    expect(archive).not.toHaveBeenCalled();
  });

  it('requires accounting entity ownership', async () => {
    mockAccountingEntityRepo.findByIdAndUserId.mockResolvedValue({
      ...accountingEntity,
      ownerId: generateUUID(),
    });

    const response = await post();

    expect(response.status).toBe(403);
    expect(archive).not.toHaveBeenCalled();
  });

  it('returns 404 when the archive use case cannot find the account', async () => {
    archive.mockRejectedValueOnce(new ledgerAccountError.AccountNotFound());

    const response = await post();

    expect(response.status).toBe(404);
    expect(response.body.errorKey).toBe(
      'ledger_error_ledger_account_not_found'
    );
  });

  it('returns 409 for a concurrent write conflict', async () => {
    archive.mockRejectedValueOnce(new repoError.VersionNotFound());

    expect((await post()).status).toBe(409);
  });

  it('sanitizes unexpected failures', async () => {
    archive.mockRejectedValueOnce(new Error('private persistence details'));

    const response = await post();

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain(
      'private persistence details'
    );
  });
});
