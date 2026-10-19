import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerAccountStatus,
  ELedgerType,
  ENormalBalance,
} from '@domain/ledger/types/ledger.types';
import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag-app.service.mock';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';

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
  getChartOfAccountsUseCase: jest.fn(),
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
const ENDPOINT = '/api/v1/ledger/chart-of-accounts';
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

describe('GET /ledger/chart-of-accounts', () => {
  let app: Express;
  const mockGetAuthUser = tokenAppService.getAuthUser as jest.Mock;
  const mockFindUser = userRepos.user.findById as jest.Mock;
  const mockFindAccountingEntity = accountingRepos.accountingEntity
    .findByIdAndUserId as jest.Mock;
  const mockGetChartOfAccounts =
    ledgerUseCases.getChartOfAccountsUseCase as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(true);
    mockGetAuthUser.mockResolvedValue({ id: userId });
    mockFindUser.mockResolvedValue(user);
    mockFindAccountingEntity.mockResolvedValue(accountingEntity);
    mockGetChartOfAccounts.mockResolvedValue([{ ...account, children: [] }]);
    app = createApplication();
  });

  describe('200 Response', () => {
    it.each(['bAnK', 'Operating Bank', '', '銀行'])(
      'forwards search %j together with class and header omission',
      async (search) => {
        const query = { class: 'asset', search, omitHeaderAccounts: true };
        const response = await request(app)
          .get(ENDPOINT)
          .query(query)
          .set('Authorization', 'Bearer valid-token')
          .set('x-accounting-entity-id', accountingEntityId);

        expect(response.status).toBe(200);
        expect(mockGetChartOfAccounts).toHaveBeenCalledWith(query);
      }
    );

    it('returns a tree of account DTOs and forwards the required class', async () => {
      const response = await request(app)
        .get(ENDPOINT)
        .query({ class: 'asset' })
        .set('Authorization', 'Bearer valid-token')
        .set('x-accounting-entity-id', accountingEntityId);

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.body).toEqual([
        {
          ...account,
          children: [],
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ]);
      expect(mockGetChartOfAccounts).toHaveBeenCalledWith({ class: 'asset' });
      expect(mockFindAccountingEntity).toHaveBeenCalledWith(
        accountingEntityId,
        userId,
        expect.any(Object)
      );
    });

    it.each([true, false])(
      'parses omitHeaderAccounts=%s as a boolean',
      async (omitHeaderAccounts) => {
        const response = await request(app)
          .get(ENDPOINT)
          .query({ class: 'expense', omitHeaderAccounts })
          .set('Authorization', 'Bearer valid-token')
          .set('x-accounting-entity-id', accountingEntityId);
        expect(response.status).toBe(200);
        expect(mockGetChartOfAccounts).toHaveBeenCalledWith({
          class: 'expense',
          omitHeaderAccounts,
        });
      }
    );

    it('returns an empty array when the class has no accounts', async () => {
      mockGetChartOfAccounts.mockResolvedValue([]);
      const response = await request(app)
        .get(ENDPOINT)
        .query({ class: 'asset' })
        .set('Authorization', 'Bearer valid-token')
        .set('x-accounting-entity-id', accountingEntityId);
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('422 Response', () => {
    it.each([
      {},
      { class: 'invalid' },
      { class: ['asset', 'expense'] },
      { class: 'asset', omitHeaderAccounts: 'invalid' },
      { class: 'asset', search: ['bank', 'cash'] },
      { search: 'bank' },
    ])(
      'rejects invalid query %j before invoking the use case',
      async (query) => {
        const response = await request(app)
          .get(ENDPOINT)
          .query(query)
          .set('Authorization', 'Bearer valid-token')
          .set('x-accounting-entity-id', accountingEntityId);
        expect(response.status).toBe(422);
        expect(mockGetChartOfAccounts).not.toHaveBeenCalled();
      }
    );
  });

  describe('500 Response', () => {
    it('rejects a request without an active accounting entity', async () => {
      const response = await request(app)
        .get(ENDPOINT)
        .query({ class: 'asset' })
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        name: 'InternalServerError',
        errorKey: 'app_error_unexpected',
      });
      expect(mockGetChartOfAccounts).not.toHaveBeenCalled();
    });
  });

  describe('401 Response', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await request(app)
        .get(ENDPOINT)
        .query({ class: 'asset' })
        .set('x-accounting-entity-id', accountingEntityId);

      expect(response.status).toBe(401);
      expect(mockGetChartOfAccounts).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('rejects an accounting entity that is not owned by the caller', async () => {
      mockFindAccountingEntity.mockResolvedValueOnce({
        ...accountingEntity,
        ownerId: '123e4567-e89b-12d3-a456-426614174099' as TEntityId,
      });
      const response = await request(app)
        .get(ENDPOINT)
        .query({ class: 'asset' })
        .set('Authorization', 'Bearer valid-token')
        .set('x-accounting-entity-id', accountingEntityId);
      expect(response.status).toBe(403);
      expect(mockGetChartOfAccounts).not.toHaveBeenCalled();
    });

    it('rejects a user without Alpha 1 access', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValueOnce(false);

      const response = await request(app)
        .get(ENDPOINT)
        .query({ class: 'asset' })
        .set('Authorization', 'Bearer valid-token')
        .set('x-accounting-entity-id', accountingEntityId);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        name: 'FeatureFlagError',
        errorKey: 'feature_flag_error_forbidden',
      });
      expect(mockGetChartOfAccounts).not.toHaveBeenCalled();
    });
  });
});
