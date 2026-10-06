import { Express } from 'express';
import request from 'supertest';

import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import makeCounterpartyService from '@domain/counterparty/services/counterparty.service';
import actorEntity from '@domain/user/entities/actor.entity';
import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagService from '@app/context/contracts/__mocks__/feature-flag.service.mock';
import { mockCounterpartyRepo } from '@app/counterparty/contracts/__mocks__/counterparty.repos.mock';
import {
  ICounterpartyCreateReq,
  ICounterpartyDto,
} from '@app/counterparty/dtos/counterparty/counterparty.dto';
import makeCreateCounterpartyUsecase from '@app/counterparty/usecases/create-counterparty.usecase';
import { mockJournalLineRepo } from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';
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
const counterpartyId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;

const validPayload: ICounterpartyCreateReq = {
  name: 'Acme Corp',
  status: 'active',
  type: 'organization',
};

const accountingEntity = {
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  id: accountingEntityId,
  ownerId: userId,
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
} as IAccountingEntity;

const createdCounterparty: ICounterpartyDto = {
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  id: counterpartyId,
  accountingEntityId,
  name: validPayload.name,
  status: validPayload.status,
  type: validPayload.type,
  meta: {},
  roles: [],
  createdAt: new Date('2026-08-01T08:00:00.000Z'),
  updatedAt: new Date('2026-08-01T08:00:00.000Z'),
};

describe('POST /counterparties', () => {
  let app: Express;
  const mockGetAuthUser = tokenService.getAuthUser as jest.Mock;
  const mockFindUser = userRepos.user.findById as jest.Mock;
  const mockFindAccountingEntity = accountingRepos.accountingEntity
    .findByIdAndUserId as jest.Mock;
  const mockCreateCounterparty =
    counterpartyUseCases.createCounterpartyUseCase as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockActorService.resolveUser.mockReset().mockResolvedValue(actor);
    mockFeatureFlagService.canAccessAlpha1.mockResolvedValue(true);
    mockGetAuthUser.mockResolvedValue({ id: userId });
    mockFindUser.mockResolvedValue({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: userId,
    } as IUser);
    mockFindAccountingEntity.mockResolvedValue(accountingEntity);
    mockCreateCounterparty.mockResolvedValue(createdCounterparty);
    app = createApplication();
  });

  const makeRequest = (payload: object = validPayload) =>
    request(app)
      .post(ENDPOINT)
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntityId)
      .send(payload);

  describe('201 Response', () => {
    it('creates a draft with only name and type business fields', async () => {
      mockCreateCounterparty.mockImplementationOnce(
        makeCreateCounterpartyUsecase({
          appContext,
          counterpartyService: makeCounterpartyService({
            journalLineRepo: mockJournalLineRepo,
          }),
          counterpartyRepo: mockCounterpartyRepo,
          eventBus: mockEventBus,
        })
      );
      const response = await makeRequest({
        name: 'Draft supplier',
        type: 'organization',
        status: 'draft',
      });
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        name: 'Draft supplier',
        type: 'organization',
        status: 'draft',
        roles: [],
        meta: {},
      });
      expect(mockCounterpartyRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'draft' }),
        expect.any(Object)
      );
    });

    it('attributes the persisted counterparty and history to the HTTP context actor', async () => {
      mockCreateCounterparty.mockImplementationOnce(
        makeCreateCounterpartyUsecase({
          appContext,
          counterpartyService: makeCounterpartyService({
            journalLineRepo: mockJournalLineRepo,
          }),
          counterpartyRepo: mockCounterpartyRepo,
          eventBus: mockEventBus,
        })
      );

      const response = await makeRequest().set('x-actor-id', 'forged-actor');

      expect(response.status).toBe(201);
      expect(response.body.createdBy).toBe(actor.id);
      expect(mockCounterpartyRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ createdBy: actor.id, accountingEntityId }),
        expect.objectContaining({
          history: expect.objectContaining({ actorId: actor.id }),
        })
      );
      expect(mockActorService.resolveUser).toHaveBeenCalledWith(
        expect.objectContaining({ id: userId, actorId: actor.id }),
        expect.objectContaining({ correlationId: expect.any(String) })
      );
    });

    it('returns 201 with the created counterparty DTO', async () => {
      const response = await makeRequest();

      expect(response.status).toBe(201);
      expect(response.type).toBe('application/json');
      expect(response.body).toEqual({
        ...createdCounterparty,
        createdAt: createdCounterparty.createdAt.toISOString(),
        updatedAt: createdCounterparty.updatedAt.toISOString(),
      });
      // The body in the controller is parsed as strings for Dates by TSOA,
      // but express parses it, and supertest gets the object.
      // The controller passes the parsed body (with converted Date objects) to the usecase.
      expect(mockCreateCounterparty).toHaveBeenCalledWith(
        expect.objectContaining({
          name: validPayload.name,
          status: validPayload.status,
          type: validPayload.type,
        })
      );
    });
  });

  describe('201 Response', () => {
    const address = { line1: 'Street', city: 'Lagos', countryCode: 'NG' };
    it.each([
      {},
      { vendor: {} },
      { vendor: { address: null } },
      { vendor: { address } },
      { employer: { address } },
      { contractor: { address } },
      { employer: { address }, vendor: {}, contractor: { address } },
    ])('passes metadata %j to the unified use case', async (meta) => {
      const response = await makeRequest({ ...validPayload, meta });
      expect(response.status).toBe(201);
      expect(mockCreateCounterparty).toHaveBeenCalledTimes(1);
      expect(mockCreateCounterparty).toHaveBeenCalledWith(
        expect.objectContaining({ meta })
      );
    });

    it('returns complete role metadata from the use case unchanged', async () => {
      const meta = {
        employer: { address, displayName: null },
        vendor: { address: null },
        contractor: { address },
      };
      const roles = ['employer', 'vendor', 'contractor'];
      mockCreateCounterparty.mockResolvedValueOnce({
        ...createdCounterparty,
        meta,
        roles,
      });
      const response = await makeRequest({ ...validPayload, meta });
      expect(response.status).toBe(201);
      expect(response.body.meta).toEqual(meta);
      expect(response.body.roles).toEqual(roles);
    });
  });

  describe('404 Response', () => {
    it.each(['vendor', 'employer', 'contractor'])(
      'does not expose the former %s POST route',
      async (role) => {
        const response = await request(app)
          .post(`${ENDPOINT}/${role}`)
          .set('Authorization', 'Bearer valid-token')
          .set('x-accounting-entity-id', accountingEntityId)
          .send(validPayload);
        expect(response.status).toBe(404);
        expect(mockCreateCounterparty).not.toHaveBeenCalled();
      }
    );
  });

  describe('422 Response', () => {
    const address = { line1: 'Street', city: 'Lagos', countryCode: 'NG' };
    it.each([
      { meta: null },
      { meta: [] },
      { meta: { customer: {} } },
      { meta: { vendor: null } },
      { meta: { employer: {} } },
      { meta: { contractor: { address: null } } },
      { meta: { vendor: { extra: true } } },
      { meta: { employer: { address, displayName: 42 } } },
      { meta: { vendor: { address: { ...address, extra: true } } } },
      { meta: { vendor: { address: { ...address, line2: null } } } },
      { roles: ['vendor'] },
      { address },
      { displayName: 'Old input' },
      { id: 'client-owned' },
      { accountingEntityId },
    ])(
      'rejects unsupported creation shape %j before orchestration',
      async (fields) => {
        const response = await makeRequest({ ...validPayload, ...fields });
        expect(response.status).toBe(422);
        expect(mockCreateCounterparty).not.toHaveBeenCalled();
      }
    );
  });

  describe('500 Response', () => {
    it('rejects a missing active accounting entity header', async () => {
      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .send(validPayload);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        name: 'InternalServerError',
        errorKey: 'app_error_unexpected',
      });
      expect(mockCreateCounterparty).not.toHaveBeenCalled();
    });
  });

  describe('401 Response', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await request(app)
        .post(ENDPOINT)
        .set('x-accounting-entity-id', accountingEntityId)
        .send(validPayload);

      expect(response.status).toBe(401);
      expect(mockCreateCounterparty).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('rejects a user without Alpha 1 access', async () => {
      mockFeatureFlagService.canAccessAlpha1.mockResolvedValueOnce(false);

      const response = await makeRequest();

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        name: 'FeatureFlagError',
        errorKey: 'feature_flag_error_forbidden',
      });
      expect(mockCreateCounterparty).not.toHaveBeenCalled();
    });
  });

  describe('422 Response', () => {
    it('rejects invalid payload with extra fields (TSOA validation)', async () => {
      const invalidPayload = {
        ...validPayload,
        extraField: 'not allowed',
      };
      const response = await makeRequest(invalidPayload);

      expect(response.status).toBe(422);
      expect(response.body.errorKey).toBe('app_error_validation_error');
      expect(mockCreateCounterparty).not.toHaveBeenCalled();
    });

    it('returns 422 if usecase validation fails (zod validation runner)', async () => {
      const validationErrors = [{ field: 'name', message: 'invalid_name' }];
      mockCreateCounterparty.mockRejectedValueOnce(
        new appError.UnprocessableEntity(validationErrors)
      );

      const response = await makeRequest();

      expect(response.status).toBe(422);
      expect(response.body.errorKey).toBe('app_error_validation_error');
      expect(response.body.validationErrors).toEqual(validationErrors);
    });
  });

  describe('500 Response', () => {
    it('sanitizes unexpected internal errors', async () => {
      mockCreateCounterparty.mockRejectedValueOnce(
        new Error('database failure')
      );

      const response = await makeRequest();

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        name: 'InternalServerError',
        errorKey: 'app_error_unexpected',
      });
    });
  });
});
