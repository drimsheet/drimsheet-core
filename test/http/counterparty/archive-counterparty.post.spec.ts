import { Express } from 'express';
import request from 'supertest';

import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import generateUUID from '@shared/utils/uuid-generator';
import repoError from '@shared/values/errors/repo.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import actorEntity from '@domain/user/entities/actor.entity';
import { IUser } from '@domain/user/types/user.types';

import { mockAccountingEntityRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import mockTokenAppService from '@app/auth/contracts/__mocks__/token-service.mock';
import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag.service.mock';
import { mockCounterpartyRepo } from '@app/counterparty/contracts/__mocks__/counterparty.repos.mock';
import makeArchiveCounterpartyUsecase from '@app/counterparty/usecases/archive-counterparty.usecase';
import { mockActorService } from '@app/user/contracts/__mocks__/actor.services.mock';
import { mockUserRepo } from '@app/user/contracts/__mocks__/user.repos.mock';

import * as counterpartyUseCases from '@infra/ioc/usecases/counterparty';
import appContext from '@infra/runtime/app-context';
import { createApplication } from '@infra/server';

jest.mock('@infra/ioc/services/user', () => ({
  ...jest.requireActual('@infra/ioc/services/user'),
  actorService: jest.requireActual(
    '@app/user/contracts/__mocks__/actor.services.mock'
  ).mockActorService,
}));
jest.mock(
  '@infra/integrations/launchdarkly/launchdarkly-feature-flag.service',
  () => ({
    __esModule: true,
    default: jest.requireActual(
      '@app/context/contracts/__mocks__/feature-flag.service.mock'
    ).default,
  })
);
jest.mock('@infra/ioc/services/auth', () => ({
  ...jest.requireActual('@infra/ioc/services/auth'),
  tokenAppService: jest.requireActual(
    '@app/auth/contracts/__mocks__/token-service.mock'
  ).default,
}));
jest.mock('@infra/persistence/repos/accounting', () => ({
  __esModule: true,
  default: {
    ...jest.requireActual('@infra/persistence/repos/accounting').default,
    accountingEntity: jest.requireActual(
      '@app/accounting/contracts/__mocks__/accounting.repos.mock'
    ).mockAccountingEntityRepo,
  },
}));
jest.mock('@infra/persistence/repos/user', () => ({
  __esModule: true,
  default: {
    ...jest.requireActual('@infra/persistence/repos/user').default,
    user: jest.requireActual('@app/user/contracts/__mocks__/user.repos.mock')
      .mockUserRepo,
  },
}));

const [actor] = actorEntity.makeUser({
  email: 'archive-http@example.test',
  displayName: 'Archiver',
});
const userId = generateUUID();
const accountingEntityId = generateUUID();
const accountingEntity = {
  id: accountingEntityId,
  createdBy: actor.id,
  ownerId: userId,
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
} as IAccountingEntity;
const [initial] = counterpartyEntity.make({
  createdBy: actor.id,
  accountingEntityId,
  name: 'Supplier',
  type: 'organization',
  status: 'draft',
});
const [counterparty] = counterpartyEntity.addRole(initial, {
  role: 'vendor',
  meta: { address: null },
});
const endpoint = `/api/v1/counterparties/${counterparty.id}/archive`;

describe('POST /counterparties/{id}/archive', () => {
  let app: Express;
  const archive = jest.spyOn(
    counterpartyUseCases,
    'archiveCounterpartyUseCase'
  );

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
    mockCounterpartyRepo.findById.mockResolvedValue(counterparty);
    mockCounterpartyRepo.update.mockResolvedValue();
    mockEventBus.publish.mockResolvedValue();
    archive.mockImplementation(
      makeArchiveCounterpartyUsecase({
        appContext,
        counterpartyRepo: mockCounterpartyRepo,
        eventBus: mockEventBus,
      })
    );
    app = createApplication();
  });

  const post = (url = endpoint) =>
    request(app)
      .post(url)
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntityId);

  describe('200 Response', () => {
    it('returns an already archived record unchanged', async () => {
      const [archived] = counterpartyEntity.archive(counterparty);
      mockCounterpartyRepo.findById.mockResolvedValue(archived);
      const response = await post();
      const expectedBody = { ...archived } as Partial<typeof archived>;
      delete expectedBody.version;
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ...expectedBody,
        createdAt: archived.createdAt.toISOString(),
        updatedAt: archived.updatedAt.toISOString(),
      });
      expect(response.body).not.toHaveProperty('version');
      expect(mockCounterpartyRepo.update).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
    it.each(['draft', 'active'] as const)(
      'archives a %s record and preserves its details',
      async (status) => {
        const current =
          status === 'draft'
            ? counterparty
            : counterpartyEntity.update(counterparty, { status: 'active' })[0];
        mockCounterpartyRepo.findById.mockResolvedValue(current);
        const response = await post().set('x-actor-id', 'forged');
        const expectedBody = { ...current } as Partial<typeof current>;
        delete expectedBody.version;
        expect(response.status).toBe(200);
        expect(response.type).toBe('application/json');
        expect(response.body).toEqual({
          ...expectedBody,
          status: 'archived',
          createdAt: current.createdAt.toISOString(),
          updatedAt: expect.any(String),
        });
        expect(response.body).not.toHaveProperty('version');
        expect(Number.isNaN(Date.parse(response.body.updatedAt))).toBe(false);
        expect(archive).toHaveBeenCalledWith(counterparty.id);
        expect(mockCounterpartyRepo.update).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'archived' }),
          expect.objectContaining({
            expectedVersion: current.version,
            history: expect.objectContaining({
              actorId: actor.id,
              action: 'archived',
            }),
          })
        );
        expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
      }
    );
  });

  describe('400 Response', () => {
    it('rejects malformed IDs without reading or writing a counterparty', async () => {
      const response = await post('/api/v1/counterparties/invalid/archive');
      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe(
        'counterparty_error_counterparty_id_invalid'
      );
      expect(mockCounterpartyRepo.findById).not.toHaveBeenCalled();
      expect(mockCounterpartyRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('401 Response', () => {
    it.each(['draft', 'archived'] as const)(
      'rejects unauthenticated callers for a %s counterparty before orchestration',
      async (status) => {
        mockCounterpartyRepo.findById.mockResolvedValue({
          ...counterparty,
          status,
        });
        const response = await request(app).post(endpoint);
        expect(response.status).toBe(401);
        expect(archive).not.toHaveBeenCalled();
      }
    );
  });

  describe('403 Response', () => {
    it.each(['draft', 'archived'] as const)(
      'rejects callers without Alpha 1 access for a %s counterparty',
      async (status) => {
        mockCounterpartyRepo.findById.mockResolvedValue({
          ...counterparty,
          status,
        });
        mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(false);
        expect((await post()).status).toBe(403);
        expect(archive).not.toHaveBeenCalled();
      }
    );
    it.each(['draft', 'archived'] as const)(
      'rejects a foreign accounting entity context for a %s counterparty',
      async (status) => {
        mockCounterpartyRepo.findById.mockResolvedValue({
          ...counterparty,
          status,
        });
        mockAccountingEntityRepo.findByIdAndUserId.mockResolvedValue({
          ...accountingEntity,
          ownerId: generateUUID(),
        });
        expect((await post()).status).toBe(403);
        expect(archive).not.toHaveBeenCalled();
        expect(mockCounterpartyRepo.update).not.toHaveBeenCalled();
      }
    );
  });

  describe('404 Response', () => {
    it.each([null, { ...counterparty, accountingEntityId: generateUUID() }])(
      'hides a missing or foreign counterparty %p',
      async (stored) => {
        mockCounterpartyRepo.findById.mockResolvedValue(stored);
        const response = await post();
        expect(response.status).toBe(404);
        expect(response.body.errorKey).toBe('app_error_resource_not_found');
        expect(mockCounterpartyRepo.findById).toHaveBeenCalledWith(
          counterparty.id,
          accountingEntityId,
          expect.any(Object)
        );
        expect(mockCounterpartyRepo.update).not.toHaveBeenCalled();
        expect(mockEventBus.publish).not.toHaveBeenCalled();
      }
    );
  });

  describe('409 Response', () => {
    it('maps a concurrent repository write conflict', async () => {
      mockCounterpartyRepo.update.mockRejectedValue(
        new repoError.VersionNotFound()
      );
      const response = await post();
      expect(response.status).toBe(409);
      expect(response.body.errorKey).toBe('repo_error_version_conflict');
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('500 Response', () => {
    it('sanitizes unexpected persistence failures and publishes no event', async () => {
      mockCounterpartyRepo.update.mockRejectedValue(
        new Error('private database details')
      );
      const response = await post();
      expect(response.status).toBe(500);
      expect(response.body.errorKey).toBe('app_error_unexpected');
      expect(JSON.stringify(response.body)).not.toContain(
        'private database details'
      );
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });
});
