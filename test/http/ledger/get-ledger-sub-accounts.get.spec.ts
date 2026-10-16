import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerAccountStatus,
  ELedgerType,
  ENormalBalance,
} from '@domain/ledger/types/ledger.types';
import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag.service.mock';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import ledgerAppError from '@app/ledger/errors/ledger.error';

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

jest.mock('@infra/ioc/services/auth', () => ({
  __esModule: true,
  tokenAppService: { getAuthUser: jest.fn() },
}));

jest.mock('@infra/ioc/usecases/ledger', () => ({
  __esModule: true,
  getBanksUseCase: jest.fn(),
  getLedgerAccountsUseCase: jest.fn(),
  getLedgerSubAccountsUseCase: jest.fn(),
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
const ENDPOINT = `/api/v1/ledger/${accountId}/sub-accounts`;
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

const account = {
  id: accountId,
  code: '100001',
  materializedPath: '100000.100001',
  accountingEntityId,
  type: ELedgerType.Asset,
  normalBalance: ENormalBalance.Debit,
  subType: 'cash_and_cash_equivalent',
  behavior: 'bank',
  isControlAccount: false,
  name: 'Operating Bank',
  status: ELedgerAccountStatus.Active,
  contraAccountRule: EContraAccountRule.ContraPermitted,
  adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
  openingBalanceDate: null,
  createdBy: userId,
  createdAt: now,
  updatedAt: now,
  balance: { amount: 10000, currencyCode: 'USD', isMinorUnit: true },
  functionalBalance: {
    amount: 10000,
    currencyCode: 'USD',
    isMinorUnit: true,
  },
} satisfies ILedgerAccountDto;

describe('GET /ledger/:accountId/sub-accounts', () => {
  let app: Express;
  const mockGetAuthUser = tokenAppService.getAuthUser as jest.Mock;
  const mockFindUser = userRepos.user.findById as jest.Mock;
  const mockFindAccountingEntity = accountingRepos.accountingEntity
    .findByIdAndUserId as jest.Mock;
  const mockGetLedgerSubAccounts =
    ledgerUseCases.getLedgerSubAccountsUseCase as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(true);
    mockGetAuthUser.mockResolvedValue({ id: userId });
    mockFindUser.mockResolvedValue(user);
    mockFindAccountingEntity.mockResolvedValue(accountingEntity);
    mockGetLedgerSubAccounts.mockResolvedValue([account]);
    app = createApplication();
  });

  describe('200 Response', () => {
    it('returns an array of ledger DTOs and forwards the parent path ID', async () => {
      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .set('x-accounting-entity-id', accountingEntityId);

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.body).toEqual([
        {
          ...account,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ]);
      expect(mockGetLedgerSubAccounts).toHaveBeenCalledWith(accountId);
      expect(mockFindAccountingEntity).toHaveBeenCalledWith(
        accountingEntityId,
        userId,
        expect.any(Object)
      );
    });

    it('returns an empty array when no sub accounts exist', async () => {
      mockGetLedgerSubAccounts.mockResolvedValue([]);
      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .set('x-accounting-entity-id', accountingEntityId);
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('400 Response', () => {
    it('maps an invalid account ID error', async () => {
      mockGetLedgerSubAccounts.mockRejectedValue(
        new ledgerAccountError.InvalidId()
      );
      const response = await request(app)
        .get('/api/v1/ledger/invalid-id/sub-accounts')
        .set('Authorization', 'Bearer valid-token')
        .set('x-accounting-entity-id', accountingEntityId);
      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe('ledger_error_id_invalid');
    });
  });

  describe('404 Response', () => {
    it('maps a missing parent account error', async () => {
      mockGetLedgerSubAccounts.mockRejectedValue(
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
    it('rejects a request without an active accounting entity', async () => {
      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        name: 'InternalServerError',
        errorKey: 'app_error_unexpected',
      });
      expect(mockGetLedgerSubAccounts).not.toHaveBeenCalled();
    });
  });

  describe('401 Response', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await request(app)
        .get(ENDPOINT)
        .set('x-accounting-entity-id', accountingEntityId);

      expect(response.status).toBe(401);
      expect(mockGetLedgerSubAccounts).not.toHaveBeenCalled();
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
      expect(mockGetLedgerSubAccounts).not.toHaveBeenCalled();
    });
  });
});
