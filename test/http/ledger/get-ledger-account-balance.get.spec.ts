import { Server } from 'node:http';

import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag-app.service.mock';
import { ILedgerAccountBalanceDto } from '@app/ledger/dtos/ledger-account/ledger-account-balance.dto';
import { getLedgerAccountBalanceQueryValidationSchema } from '@app/ledger/dtos/ledger-account/ledger-account-balance.dto.validation';
import ledgerAppError from '@app/ledger/errors/ledger.error';

import { tokenAppService } from '@infra/ioc/services/auth';
import * as ledgerUseCases from '@infra/ioc/usecases/ledger';
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

jest.mock('@infra/ioc/services/auth', () => ({
  __esModule: true,
  tokenAppService: { getAuthUser: jest.fn() },
}));

jest.mock('@infra/ioc/usecases/ledger', () => ({
  __esModule: true,
  getBanksUseCase: jest.fn(),
  getLedgerAccountsUseCase: jest.fn(),
  getPermittedPostingAccountsUseCase: jest.fn(),
  getLedgerAccountBalanceUseCase: jest.fn(),
  getAccountTransactionsUseCase: jest.fn(),
  createPettyCashAccountUseCase: jest.fn(),
  createBankAccountUseCase: jest.fn(),
}));

jest.mock('@infra/persistence/repos/user', () => ({
  __esModule: true,
  default: { user: { findById: jest.fn() } },
}));

const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const code = '100001';
const ENDPOINT = `/api/v1/ledger/code/${code}/balance`;
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
  createdBy: userId,
  ledgerAccountId: '123e4567-e89b-12d3-a456-426614174003' as TEntityId,
  accountingEntityId: '123e4567-e89b-12d3-a456-426614174002' as TEntityId,
  accountMaterializedPath: '100000.100001',
  version: 1,
  createdAt: now,
  updatedAt: now,
  amount: { amount: 10000, currencyCode: 'USD', isMinorUnit: true },
  functionalAmount: {
    amount: 10000,
    currencyCode: 'USD',
    isMinorUnit: true,
  },
} satisfies ILedgerAccountBalanceDto;

describe('GET /ledger/code/{code}/balance', () => {
  let app: Express;
  let server: Server;
  const mockGetAuthUser = tokenAppService.getAuthUser as jest.Mock;
  const mockFindUser = userRepos.user.findById as jest.Mock;
  const mockGetLedgerAccount =
    ledgerUseCases.getLedgerAccountBalanceUseCase as jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(true);
    mockGetAuthUser.mockResolvedValue({ id: userId });
    mockFindUser.mockResolvedValue(user);
    mockGetLedgerAccount.mockResolvedValue(account);
    app = createApplication();
    server = await startTestServer(app);
  });

  afterEach(async () => {
    await closeTestServer(server);
  });

  describe('200 Response', () => {
    it('returns the requested ledger account balances', async () => {
      const response = await request(server)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.body).toEqual({
        ...account,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
      expect(mockGetLedgerAccount).toHaveBeenCalledWith(code);
    });
  });

  describe('422 Response', () => {
    it('maps invalid ledger codes to the validation response', async () => {
      mockGetLedgerAccount.mockImplementationOnce((value: string) => {
        zodValidationRunner(getLedgerAccountBalanceQueryValidationSchema, {
          code: value,
        });
      });
      const response = await request(server)
        .get('/api/v1/ledger/code/invalid/balance')
        .set('Authorization', 'Bearer valid-token');
      expect(response.status).toBe(422);
      expect(response.body.errorKey).toBe('app_error_validation_error');
      expect(mockGetLedgerAccount).toHaveBeenCalledWith('invalid');
    });
  });

  describe('500 Response', () => {
    it('returns an unexpected error when the account has no balance record', async () => {
      mockGetLedgerAccount.mockRejectedValueOnce(
        new ledgerAppError.BalanceNotFound()
      );
      const response = await request(server)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token');
      expect(response.status).toBe(500);
      expect(response.body.errorKey).toBe('app_error_unexpected');
    });
  });

  describe('404 Response', () => {
    it('returns not found for a code absent from the selected entity', async () => {
      mockGetLedgerAccount.mockRejectedValueOnce(
        new ledgerAppError.AccountNotFound()
      );
      const response = await request(server)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token');
      expect(response.status).toBe(404);
      expect(response.body.errorKey).toBe('app_error_ledger_account_not_found');
    });
  });

  describe('401 Response', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await request(server).get(ENDPOINT);

      expect(response.status).toBe(401);
      expect(mockGetLedgerAccount).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('rejects a user without Alpha 1 access', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValueOnce(false);

      const response = await request(server)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        name: 'FeatureFlagError',
        errorKey: 'feature_flag_error_forbidden',
      });
      expect(mockGetLedgerAccount).not.toHaveBeenCalled();
    });
  });
});
