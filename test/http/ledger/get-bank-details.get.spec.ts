import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import { IBankDetails } from '@domain/ledger/types/asset-account.types';
import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag-app.service.mock';
import ledgerAppError from '@app/ledger/errors/ledger.error';

import { tokenAppService } from '@infra/ioc/services/auth';
import * as ledgerUseCases from '@infra/ioc/usecases/ledger';
import accountingRepos from '@infra/persistence/repos/accounting';
import userRepos from '@infra/persistence/repos/user';

import createApplication from '@interface/http/application';

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

jest.mock('@infra/ioc/services/auth', () => ({
  __esModule: true,
  tokenAppService: { getAuthUser: jest.fn() },
}));

jest.mock('@infra/ioc/usecases/ledger', () => ({
  __esModule: true,
  getBanksUseCase: jest.fn(),
  getLedgerAccountsUseCase: jest.fn(),
  getBankDetailsUseCase: jest.fn(),
  getLedgerAccountUseCase: jest.fn(),
  adjustLedgerAccountBalanceUseCase: jest.fn(),
  getAccountTransactionsUseCase: jest.fn(),
  createPettyCashAccountUseCase: jest.fn(),
  createBankAccountUseCase: jest.fn(),
}));

jest.mock('@infra/persistence/repos/accounting', () => ({
  __esModule: true,
  default: {
    accountingEntity: { findByIdAndUserId: jest.fn() },
  },
}));

jest.mock('@infra/persistence/repos/user', () => ({
  __esModule: true,
  default: { user: { findById: jest.fn() } },
}));

const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const accountingEntityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const accountId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
const ENDPOINT = `/api/v1/ledger/${accountId}/bank-details`;
const now = new Date('2026-08-09T10:00:00.000Z');

const user = {
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  id: userId,
  version: 1,
  email: 'posting@example.com',
  emailVerified: true,
  firstName: 'Posting',
  lastName: 'User',
  deletedAt: null,
  createdAt: now,
  updatedAt: now,
} satisfies IUser;

const accountingEntity = {
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  id: accountingEntityId,
  ownerId: userId,
  name: 'Posting Entity',
  type: 'individual',
  status: 'active',
  functionalCurrencyCode: 'USD',
  jurisdictionCode: 'US',
  createdAt: now,
  updatedAt: now,
} satisfies IAccountingEntity;

const bankDetails: IBankDetails = {
  countryCode: 'US',
  bankName: 'Example Bank',
  accountName: 'Operating Account',
  accountNumber: '1234567890',
};

describe('GET /ledger/:accountId/bank-details', () => {
  let app: Express;
  const mockGetAuthUser = tokenAppService.getAuthUser as jest.Mock;
  const mockFindUser = userRepos.user.findById as jest.Mock;
  const mockFindAccountingEntity = accountingRepos.accountingEntity
    .findByIdAndUserId as jest.Mock;
  const mockGetBankDetails = ledgerUseCases.getBankDetailsUseCase as jest.Mock;

  beforeEach(() => {
    jest.resetAllMocks();
    mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(true);
    mockGetAuthUser.mockResolvedValue({ id: userId });
    mockFindUser.mockResolvedValue(user);
    mockFindAccountingEntity.mockResolvedValue(accountingEntity);
    mockGetBankDetails.mockResolvedValue(bankDetails);
    app = createApplication();
  });

  describe('200 Response', () => {
    it('returns bank details and forwards the ledger account path ID', async () => {
      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .set('x-accounting-entity-id', accountingEntityId);

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.body).toEqual(bankDetails);
      expect(mockGetBankDetails).toHaveBeenCalledWith(accountId);
      expect(mockFindAccountingEntity).toHaveBeenCalledWith(
        accountingEntityId,
        userId,
        expect.any(Object)
      );
    });
  });

  describe('400 Response', () => {
    it('maps an invalid account ID error', async () => {
      mockGetBankDetails.mockRejectedValue(new ledgerAccountError.InvalidId());
      const response = await request(app)
        .get('/api/v1/ledger/invalid-id/bank-details')
        .set('Authorization', 'Bearer valid-token')
        .set('x-accounting-entity-id', accountingEntityId);
      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe('ledger_error_id_invalid');
    });
  });

  describe('400 Response for a non-bank account', () => {
    it('maps the invalid behavior error', async () => {
      mockGetBankDetails.mockRejectedValue(
        new ledgerAccountError.InvalidBehavior()
      );
      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .set('x-accounting-entity-id', accountingEntityId);
      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe(
        'ledger_error_ledger_account_behavior_invalid'
      );
    });
  });

  describe('404 Response', () => {
    it('maps a missing ledger account error', async () => {
      mockGetBankDetails.mockRejectedValue(
        new ledgerAppError.AccountNotFound()
      );
      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .set('x-accounting-entity-id', accountingEntityId);
      expect(response.status).toBe(404);
      expect(response.body.errorKey).toBe('app_error_ledger_account_not_found');
    });
  });

  describe('500 Response', () => {
    it('rejects access to another user accounting entity', async () => {
      mockFindAccountingEntity.mockResolvedValue(null);
      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .set('x-accounting-entity-id', accountingEntityId);
      expect(response.status).toBe(500);
      expect(mockGetBankDetails).not.toHaveBeenCalled();
    });

    it('rejects a request without an active accounting entity', async () => {
      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        name: 'InternalServerError',
        errorKey: 'app_error_unexpected',
      });
      expect(mockGetBankDetails).not.toHaveBeenCalled();
    });
  });

  describe('401 Response', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await request(app)
        .get(ENDPOINT)
        .set('x-accounting-entity-id', accountingEntityId);

      expect(response.status).toBe(401);
      expect(mockGetBankDetails).not.toHaveBeenCalled();
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
      expect(mockGetBankDetails).not.toHaveBeenCalled();
    });
  });
});
