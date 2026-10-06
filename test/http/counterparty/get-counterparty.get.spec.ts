import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagService from '@app/context/contracts/__mocks__/feature-flag.service.mock';
import { ICounterpartyDto } from '@app/counterparty/dtos/counterparty/counterparty.dto';

import { tokenService } from '@infra/ioc/services/auth';
import * as counterpartyUseCases from '@infra/ioc/usecases/counterparty';
import accountingRepos from '@infra/persistence/repos/accounting';
import userRepos from '@infra/persistence/repos/user';
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
  getCounterpartyUseCase: jest.fn(),
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

const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const accountingEntityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const counterpartyId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
const ENDPOINT = `/api/v1/counterparties/${counterpartyId}`;

const accountingEntity = {
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  id: accountingEntityId,
  ownerId: userId,
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
} as IAccountingEntity;

const counterparty: ICounterpartyDto = {
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  id: counterpartyId,
  accountingEntityId,
  name: 'Acme Corp',
  status: 'active',
  type: 'organization',
  meta: { vendor: { address: null } },
  roles: ['vendor'],
  createdAt: new Date('2026-08-01T08:00:00.000Z'),
  updatedAt: new Date('2026-08-02T08:00:00.000Z'),
};

describe('GET /counterparties/{id}', () => {
  let app: Express;
  const mockGetAuthUser = tokenService.getAuthUser as jest.Mock;
  const mockFindUser = userRepos.user.findById as jest.Mock;
  const mockFindAccountingEntity = accountingRepos.accountingEntity
    .findByIdAndUserId as jest.Mock;
  const mockGetCounterparty =
    counterpartyUseCases.getCounterpartyUseCase as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFeatureFlagService.canAccessAlpha1.mockResolvedValue(true);
    mockGetAuthUser.mockResolvedValue({ id: userId });
    mockFindUser.mockResolvedValue({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: userId,
    } as IUser);
    mockFindAccountingEntity.mockResolvedValue(accountingEntity);
    mockGetCounterparty.mockResolvedValue(counterparty);
    app = createApplication();
  });

  const makeRequest = (endpoint = ENDPOINT) =>
    request(app)
      .get(endpoint)
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntityId);

  describe('200 Response', () => {
    it('returns the counterparty DTO and forwards the path ID', async () => {
      const response = await makeRequest();

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.body).toEqual({
        ...counterparty,
        createdAt: counterparty.createdAt.toISOString(),
        updatedAt: counterparty.updatedAt.toISOString(),
      });
      expect(mockFindAccountingEntity).toHaveBeenCalledWith(
        accountingEntityId,
        userId,
        expect.any(Object)
      );
      expect(mockGetCounterparty).toHaveBeenCalledWith(counterpartyId);
    });
  });

  describe('400 Response', () => {
    it('maps an invalid counterparty ID', async () => {
      mockGetCounterparty.mockRejectedValueOnce(
        new counterpartyError.InvalidCounterpartyId()
      );

      const response = await makeRequest('/api/v1/counterparties/invalid-id');

      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe(
        'counterparty_error_counterparty_id_invalid'
      );
      expect(mockGetCounterparty).toHaveBeenCalledWith('invalid-id');
    });
  });

  describe('401 Response', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await request(app)
        .get(ENDPOINT)
        .set('x-accounting-entity-id', accountingEntityId);

      expect(response.status).toBe(401);
      expect(mockGetCounterparty).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('rejects a user without Alpha 1 access', async () => {
      mockFeatureFlagService.canAccessAlpha1.mockResolvedValueOnce(false);

      const response = await makeRequest();

      expect(response.status).toBe(403);
      expect(mockGetCounterparty).not.toHaveBeenCalled();
    });

    it('rejects a foreign accounting entity context', async () => {
      mockFindAccountingEntity.mockResolvedValueOnce({
        ...accountingEntity,
        ownerId: '123e4567-e89b-12d3-a456-426614174999' as TEntityId,
      });

      const response = await makeRequest();

      expect(response.status).toBe(403);
      expect(mockGetCounterparty).not.toHaveBeenCalled();
    });
  });

  describe('404 Response', () => {
    it('maps an absent or out-of-scope counterparty', async () => {
      mockGetCounterparty.mockRejectedValueOnce(
        new appError.ResourceNotFound({ id: counterpartyId })
      );

      const response = await makeRequest();

      expect(response.status).toBe(404);
      expect(response.body.errorKey).toBe('app_error_resource_not_found');
    });
  });

  describe('500 Response', () => {
    it('sanitizes unexpected failures', async () => {
      mockGetCounterparty.mockRejectedValueOnce(new Error('database failure'));

      const response = await makeRequest();

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        name: 'InternalServerError',
        errorKey: 'app_error_unexpected',
      });
    });
  });
});
