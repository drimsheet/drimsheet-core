import { Server } from 'node:http';

import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
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

jest.mock('../../../src/infra/ioc/services/auth', () => ({
  __esModule: true,
  tokenAppService: { getAuthUser: jest.fn() },
}));

jest.mock('../../../src/infra/ioc/usecases/accounting', () => ({
  __esModule: true,
  createAccountingEntityUseCase: jest.fn(),
  getJurisdictionsUseCase: jest.fn(),
  getUserAccountingEntitiesUseCase: jest.fn(),
  getActiveAccountingEntityUseCase: jest.fn(),
  deleteAccountingEntityUseCase: jest.fn(),
  archiveAccountingEntityUseCase: jest.fn(),
}));

jest.mock('../../../src/infra/persistence/repos/accounting', () => ({
  __esModule: true,
  default: {
    accountingEntity: { findByIdAndUserId: jest.fn() },
  },
}));

jest.mock('../../../src/infra/persistence/repos/user', () => ({
  __esModule: true,
  default: { user: { findById: jest.fn() } },
}));

const ENDPOINT = '/api/v1/accounting/accounting-entity/archive';
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

describe('POST /accounting/accounting-entity/archive', () => {
  let app: Express;
  let server: Server;
  const archive = jest.mocked(
    accountingUsecases.archiveAccountingEntityUseCase
  );
  const findEntity = jest.mocked(
    accountingRepos.accountingEntity.findByIdAndUserId
  );
  const getUser = jest.mocked(tokenAppService.getAuthUser);
  beforeEach(async () => {
    jest.resetAllMocks();
    mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(true);
    getUser.mockResolvedValue({ id: userId } as never);
    jest.mocked(userRepos.user.findById).mockResolvedValue({
      id: userId,
      actorId: entity.createdBy,
      createdBy: entity.createdBy,
    } as IUser);
    findEntity.mockResolvedValue(entity);
    archive.mockResolvedValue(undefined);
    app = createApplication();
    server = await startTestServer(app);
  });

  afterEach(async () => {
    await closeTestServer(server);
  });

  function archiveEntity(id = entity.id) {
    return request(server)
      .post(ENDPOINT)
      .set('Authorization', 'Bearer token')
      .set('x-accounting-entity-id', id);
  }

  describe('204 Response', () => {
    it('delegates explicit archival of the selected entity and returns an empty response', async () => {
      const response = await archiveEntity();
      expect(response.status).toBe(204);
      expect(response.text).toBe('');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(archive).toHaveBeenCalledWith();
      expect(
        accountingUsecases.deleteAccountingEntityUseCase
      ).not.toHaveBeenCalled();
      expect(findEntity).toHaveBeenCalledWith(
        entity.id,
        userId,
        expect.any(Object)
      );
    });
  });
  describe('400 Response', () => {
    it('rejects a malformed selection before orchestration', async () => {
      const response = await archiveEntity('bad-id' as TEntityId);
      expect(response.status).toBe(400);
      expect(archive).not.toHaveBeenCalled();
    });
  });
  describe('401 Response', () => {
    it('rejects an unauthenticated request', async () => {
      getUser.mockRejectedValue(new authError.ExpiredToken());
      expect((await archiveEntity()).status).toBe(401);
      expect(archive).not.toHaveBeenCalled();
    });
  });
  describe('403 Response', () => {
    it('enforces ownership before orchestration', async () => {
      findEntity.mockResolvedValue({
        ...entity,
        ownerId: 'b2222222-2222-4222-8222-222222222222' as TEntityId,
      });
      expect((await archiveEntity()).status).toBe(403);
      expect(archive).not.toHaveBeenCalled();
    });
    it('enforces alpha access', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(false);
      expect((await archiveEntity()).status).toBe(403);
      expect(archive).not.toHaveBeenCalled();
    });
  });
  describe('404 Response', () => {
    it('maps a missing or unavailable active entity', async () => {
      archive.mockRejectedValue(new accountingAppError.ActiveEntityNotFound());
      const response = await archiveEntity();
      expect(response.status).toBe(404);
      expect(response.body.errorKey).toBe(
        new accountingAppError.ActiveEntityNotFound().errorKey
      );
    });
  });
  describe('500 Response', () => {
    it('does not expose persistence errors', async () => {
      archive.mockRejectedValue(new Error('private database details'));
      const response = await archiveEntity();
      expect(response.status).toBe(500);
      expect(JSON.stringify(response.body)).not.toContain(
        'private database details'
      );
    });
  });
});
