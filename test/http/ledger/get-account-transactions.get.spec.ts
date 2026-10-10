import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';
import { IPaginatedResponse } from '@shared/values/pagination/types/pagination.types';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag.service.mock';
import { IAccountTransactionRes } from '@app/ledger/dtos/account-transaction/account-transaction.dto';

import { tokenAppService } from '@infra/ioc/services/auth';
import * as ledgerUseCases from '@infra/ioc/usecases/ledger';
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
  tokenAppService: { getAuthUser: jest.fn() },
}));

jest.mock('../../../src/infra/ioc/usecases/ledger', () => ({
  __esModule: true,
  getBanksUseCase: jest.fn(),
  getLedgerAccountsUseCase: jest.fn(),
  getPermittedPostingAccountsUseCase: jest.fn(),
  getLedgerAccountUseCase: jest.fn(),
  getAccountTransactionsUseCase: jest.fn(),
  createPettyCashAccountUseCase: jest.fn(),
  createBankAccountUseCase: jest.fn(),
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

const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const accountingEntityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const accountId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
const ENDPOINT = `/api/v1/ledger/${accountId}/transactions`;
const now = new Date('2026-08-20T10:00:00.000Z');

const user = {
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  id: userId,
  version: 1,
  email: 'ledger@example.com',
  emailVerified: true,
  firstName: 'Ledger',
  lastName: 'User',
  deletedAt: null,
  createdAt: now,
  updatedAt: now,
} satisfies IUser;

const accountingEntity = {
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  id: accountingEntityId,
  ownerId: userId,
  name: 'Ledger Entity',
  type: 'individual',
  functionalCurrencyCode: 'USD',
  jurisdictionCode: 'US',
  createdAt: now,
  updatedAt: now,
} satisfies IAccountingEntity;

describe('GET /ledger/:accountId/transactions', () => {
  let app: Express;
  const mockGetAuthUser = tokenAppService.getAuthUser as jest.Mock;
  const mockFindUser = userRepos.user.findById as jest.Mock;
  const mockFindAccountingEntity = accountingRepos.accountingEntity
    .findByIdAndUserId as jest.Mock;
  const mockGetAccountTransactions =
    ledgerUseCases.getAccountTransactionsUseCase as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(true);
    mockGetAuthUser.mockResolvedValue({ id: userId });
    mockFindUser.mockResolvedValue(user);
    mockFindAccountingEntity.mockResolvedValue(accountingEntity);
    mockGetAccountTransactions.mockResolvedValue({
      data: [],
      meta: { page: 2, limit: 5, total: 0, totalPages: 0 },
    } satisfies IPaginatedResponse<IAccountTransactionRes>);
    app = createApplication();
  });

  describe('200 Response', () => {
    it('returns account transactions and forwards coerced pagination', async () => {
      const response = await request(app)
        .get(`${ENDPOINT}?page=2&limit=5`)
        .set('Authorization', 'Bearer valid-token')
        .set('x-accounting-entity-id', accountingEntityId);

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.body).toEqual({
        data: [],
        meta: { page: 2, limit: 5, total: 0, totalPages: 0 },
      });
      expect(mockFindAccountingEntity).toHaveBeenCalledWith(
        accountingEntityId,
        userId,
        expect.any(Object)
      );
      expect(mockGetAccountTransactions).toHaveBeenCalledWith(accountId, {
        page: 2,
        limit: 5,
      });
    });
  });

  describe('401 Response', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await request(app)
        .get(ENDPOINT)
        .set('x-accounting-entity-id', accountingEntityId);

      expect(response.status).toBe(401);
      expect(mockGetAccountTransactions).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('rejects a user without Alpha 1 access', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValueOnce(false);

      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .set('x-accounting-entity-id', accountingEntityId);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        name: 'FeatureFlagError',
        errorKey: 'feature_flag_error_forbidden',
      });
      expect(mockGetAccountTransactions).not.toHaveBeenCalled();
    });
  });
});
