import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';
import { IPaginatedResponse } from '@shared/values/pagination/types/pagination.types';

import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerAccountStatus,
  ELedgerType,
  ENormalBalance,
} from '@domain/ledger/types/ledger.types';
import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagService from '@app/context/contracts/__mocks__/feature-flag.service.mock';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';

import { tokenService } from '@infra/ioc/services/auth';
import * as ledgerUseCases from '@infra/ioc/usecases/ledger';
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

jest.mock('../../../src/infra/persistence/repos/user', () => ({
  __esModule: true,
  default: { user: { findById: jest.fn() } },
}));

const ENDPOINT = '/api/v1/ledger';
const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const accountingEntityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const accountId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
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

describe('GET /ledger', () => {
  let app: Express;
  const mockGetAuthUser = tokenService.getAuthUser as jest.Mock;
  const mockFindUser = userRepos.user.findById as jest.Mock;
  const mockGetLedgerAccounts =
    ledgerUseCases.getLedgerAccountsUseCase as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFeatureFlagService.canAccessAlpha1.mockResolvedValue(true);
    mockGetAuthUser.mockResolvedValue({ id: userId });
    mockFindUser.mockResolvedValue(user);
    mockGetLedgerAccounts.mockResolvedValue({
      data: [account],
      meta: { page: 2, limit: 5, total: 1, totalPages: 1 },
    } satisfies IPaginatedResponse<ILedgerAccountDto>);
    app = createApplication();
  });

  describe('200 Response', () => {
    it('returns ledger accounts and forwards coerced query values', async () => {
      const response = await request(app)
        .get(`${ENDPOINT}?type=asset&page=2&limit=5&isControlAccount=false`)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.body).toEqual({
        data: [
          {
            ...account,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          },
        ],
        meta: { page: 2, limit: 5, total: 1, totalPages: 1 },
      });
      expect(mockGetLedgerAccounts).toHaveBeenCalledWith({
        type: 'asset',
        page: 2,
        limit: 5,
        isControlAccount: false,
      });
    });
  });

  describe('401 Response', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await request(app).get(ENDPOINT);

      expect(response.status).toBe(401);
      expect(mockGetLedgerAccounts).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('rejects a user without Alpha 1 access', async () => {
      mockFeatureFlagService.canAccessAlpha1.mockResolvedValueOnce(false);

      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        name: 'FeatureFlagError',
        errorKey: 'feature_flag_error_forbidden',
      });
      expect(mockGetLedgerAccounts).not.toHaveBeenCalled();
    });
  });
});
