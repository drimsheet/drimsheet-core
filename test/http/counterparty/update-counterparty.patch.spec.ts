import { Express } from 'express';
import request from 'supertest';

import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import repoError from '@shared/values/errors/repo.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import makeCounterpartyService from '@domain/counterparty/services/counterparty.service';
import actorEntity from '@domain/user/entities/actor.entity';
import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagService from '@app/context/contracts/__mocks__/feature-flag.service.mock';
import { mockCounterpartyRepo } from '@app/counterparty/contracts/__mocks__/counterparty.repos.mock';
import makeUpdateCounterpartyUsecase from '@app/counterparty/usecases/update-counterparty.usecase';
import { mockActorService } from '@app/user/contracts/__mocks__/actor.services.mock';

import { tokenService } from '@infra/ioc/services/auth';
import * as counterpartyUseCases from '@infra/ioc/usecases/counterparty';
import accountingRepos from '@infra/persistence/repos/accounting';
import userRepos from '@infra/persistence/repos/user';
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
    default: jest.requireActual<
      typeof import('@app/context/contracts/__mocks__/feature-flag.service.mock')
    >('@app/context/contracts/__mocks__/feature-flag.service.mock').default,
  })
);

jest.mock('../../../src/infra/ioc/services/auth', () => ({
  __esModule: true,
  tokenService: { getAuthUser: jest.fn() },
}));

jest.mock('../../../src/infra/ioc/usecases/counterparty', () => ({
  __esModule: true,
  createCounterpartyUseCase: jest.fn(),
  updateCounterpartyUseCase: jest.fn(),
  getCounterpartiesUseCase: jest.fn(),
}));

jest.mock('../../../src/infra/persistence/repos/accounting', () => ({
  __esModule: true,
  default: {
    accountingEntity: { findByIdAndUserId: jest.fn() },
  },
}));

jest.mock('../../../src/infra/persistence/repos/user', () => ({
  __esModule: true,
  default: {
    user: { findById: jest.fn() },
  },
}));

const ENDPOINT = '/api/v1/counterparties';
const actor = {
  ...actorEntity.makeUser({
    email: 'user@example.com',
    displayName: 'User',
  })[0],
  id: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
};
const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const accountingEntityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;

const accountingEntity = {
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  id: accountingEntityId,
  ownerId: userId,
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
} as IAccountingEntity;

describe('PATCH /counterparties/{id}', () => {
  let app: Express;
  const update = counterpartyUseCases.updateCounterpartyUseCase as jest.Mock;
  const service = makeCounterpartyService();
  const [draft] = service.create({
    createdBy: actor.id,
    accountingEntityId: accountingEntityId as TEntityId,
    name: 'Draft',
    type: 'organization',
    status: 'draft',
    meta: { vendor: {} },
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockActorService.resolveUser.mockResolvedValue(actor);
    mockFeatureFlagService.canAccessAlpha1.mockResolvedValue(true);
    jest.mocked(tokenService.getAuthUser).mockResolvedValue({ id: userId });
    jest.mocked(userRepos.user.findById).mockResolvedValue({
      id: userId,
      actorId: actor.id,
      createdBy: actor.id,
    } as IUser);
    jest
      .mocked(accountingRepos.accountingEntity.findByIdAndUserId)
      .mockResolvedValue(accountingEntity);
    mockCounterpartyRepo.findById.mockResolvedValue(draft);
    update.mockImplementation(
      makeUpdateCounterpartyUsecase({
        appContext,
        counterpartyService: service,
        counterpartyRepo: mockCounterpartyRepo,
        eventBus: mockEventBus,
      })
    );
    app = createApplication();
  });

  const patch = (body: object, id = draft.id) =>
    request(app)
      .patch(`${ENDPOINT}/${id}`)
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntityId)
      .send({ expectedVersion: draft.version, ...body });

  describe('200 Response', () => {
    it('lets an ordinary user activate with corrections and trusted actor attribution', async () => {
      const response = await patch({ name: 'Complete', status: 'active' }).set(
        'x-actor-id',
        'forged'
      );
      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.body).toMatchObject({
        id: draft.id,
        name: 'Complete',
        status: 'active',
        createdBy: actor.id,
        roles: ['vendor'],
        version: draft.version + 1,
      });
      expect(response.body.createdAt).toBe(draft.createdAt.toISOString());
      expect(mockCounterpartyRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'active' }),
        expect.objectContaining({
          history: expect.objectContaining({
            actorId: actor.id,
            action: 'activated',
          }),
        })
      );
    });
    it.each([
      { name: 'Changed' },
      { meta: {} },
      {
        meta: {
          contractor: {
            address: { line1: 'Road', city: 'Lagos', countryCode: 'NG' },
          },
        },
      },
    ])('applies replacement/omission semantics %j', async (payload) => {
      const response = await patch(payload);
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('draft');
      expect(response.body.roles).toEqual(
        payload.meta ? Object.keys(payload.meta) : ['vendor']
      );
    });
    it('edits an Active record when status is omitted', async () => {
      const [active] = service.update(draft, { status: 'active' });
      mockCounterpartyRepo.findById.mockResolvedValue(active);
      expect(
        (await patch({ name: 'Edited', expectedVersion: active.version }))
          .status
      ).toBe(200);
    });
  });
  describe('401 Response', () => {
    it('rejects unauthenticated callers', async () => {
      expect(
        (
          await request(app)
            .patch(`${ENDPOINT}/${draft.id}`)
            .send({ status: 'active' })
        ).status
      ).toBe(401);
      expect(update).not.toHaveBeenCalled();
    });
  });
  describe('403 Response', () => {
    it('rejects callers without Alpha 1 access', async () => {
      mockFeatureFlagService.canAccessAlpha1.mockResolvedValue(false);
      expect((await patch({ status: 'active' })).status).toBe(403);
      expect(update).not.toHaveBeenCalled();
    });
    it('rejects access to another owner accounting entity', async () => {
      jest
        .mocked(accountingRepos.accountingEntity.findByIdAndUserId)
        .mockResolvedValue({ ...accountingEntity, ownerId: generateUUID() });
      expect((await patch({ status: 'active' })).status).toBe(403);
      expect(mockCounterpartyRepo.update).not.toHaveBeenCalled();
    });
  });
  describe('404 Response', () => {
    it('treats absent and foreign-tenant counterparty IDs alike', async () => {
      mockCounterpartyRepo.findById.mockResolvedValue(null);
      expect((await patch({ status: 'active' })).status).toBe(404);
      expect(mockCounterpartyRepo.findById).toHaveBeenCalledWith(
        draft.id,
        accountingEntityId,
        expect.any(Object)
      );
      expect(mockCounterpartyRepo.update).not.toHaveBeenCalled();
    });
  });
  describe('409 Response', () => {
    it('rejects stale versions before preparing an update', async () => {
      mockCounterpartyRepo.findById.mockResolvedValue({
        ...draft,
        version: draft.version + 1,
      });
      const response = await patch({ name: 'Stale edit' });
      expect(response.status).toBe(409);
      expect(response.body.errorKey).toBe('app_error_conflict');
      expect(mockCounterpartyRepo.update).not.toHaveBeenCalled();
    });
    it('returns a conflict if another writer wins after the read', async () => {
      mockCounterpartyRepo.update.mockRejectedValue(
        new repoError.VersionNotFound()
      );
      expect((await patch({ status: 'active' })).status).toBe(409);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
    it.each(['active', 'archived'] as const)(
      'rejects activation of %s',
      async (status) => {
        mockCounterpartyRepo.findById.mockResolvedValue(
          service.create({
            createdBy: actor.id,
            accountingEntityId: accountingEntityId as TEntityId,
            name: 'Existing',
            type: 'individual',
            status,
          })[0]
        );
        const response = await patch({ status: 'active', expectedVersion: 1 });
        expect(response.status).toBe(409);
        expect(response.body.errorKey).toBe(
          status === 'active'
            ? new counterpartyError.AlreadyActive().errorKey
            : new counterpartyError.Archived().errorKey
        );
        expect(mockCounterpartyRepo.update).not.toHaveBeenCalled();
      }
    );
  });
  describe('422 Response', () => {
    it.each([
      {},
      { status: 'draft' },
      { status: 'archived' },
      { name: '' },
      { roles: [] },
      { meta: null },
      { meta: { vendor: null } },
      { accountingEntityId },
      { createdBy: actor.id },
    ])('rejects invalid update %j', async (payload) => {
      expect((await patch(payload)).status).toBe(422);
      expect(mockCounterpartyRepo.update).not.toHaveBeenCalled();
    });
    it.each([undefined, null, 0, -1, 1.5, 'invalid'])(
      'rejects invalid expectedVersion %p',
      async (expectedVersion) => {
        expect((await patch({ expectedVersion, name: 'Changed' })).status).toBe(
          422
        );
        expect(mockCounterpartyRepo.findById).not.toHaveBeenCalled();
      }
    );
    it('identifies the missing nested field and preserves Draft', async () => {
      const response = await patch({
        status: 'active',
        meta: {
          contractor: {
            address: { line1: 'Road', city: '', countryCode: 'NG' },
          },
        },
      });
      expect(response.status).toBe(422);
      expect(response.body.validationErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: expect.stringContaining('city') }),
        ])
      );
      expect(mockCounterpartyRepo.update).not.toHaveBeenCalled();
      expect(draft.status).toBe('draft');
    });
  });
  describe('400 Response', () => {
    it('rejects effective no-change updates', async () => {
      expect((await patch({ name: draft.name })).status).toBe(400);
      expect(mockCounterpartyRepo.update).not.toHaveBeenCalled();
    });
    it('rejects malformed IDs', async () => {
      expect(
        (await patch({ status: 'active' }, 'invalid' as TEntityId)).status
      ).toBe(400);
    });
  });
  describe('500 Response', () => {
    it('sanitizes unexpected persistence failures', async () => {
      mockCounterpartyRepo.update.mockRejectedValue(
        new Error('private db details')
      );
      const response = await patch({ status: 'active' });
      expect(response.status).toBe(500);
      expect(response.body.errorKey).toBe('app_error_unexpected');
      expect(JSON.stringify(response.body)).not.toContain('private db details');
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });
});
