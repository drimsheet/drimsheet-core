import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';

import periodError from '@domain/accounting/errors/period.error';
import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagService from '@app/context/contracts/__mocks__/feature-flag.service.mock';
import { IBankAccountCreationReq } from '@app/ledger/dtos/asset-account/asset-account.dto';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';

import { tokenService } from '@infra/ioc/services/auth';
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
  tokenService: { getAuthUser: jest.fn() },
}));

jest.mock('../../../src/infra/ioc/usecases/ledger', () => ({
  __esModule: true,
  getBanksUseCase: jest.fn(),
  getLedgerAccountsUseCase: jest.fn(),
  getLedgerAccountUseCase: jest.fn(),
  adjustLedgerAccountBalanceUseCase: jest.fn(),
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
  default: {
    user: { findById: jest.fn() },
  },
}));

const ENDPOINT = '/api/v1/ledger/asset/bank';
const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const accountingEntityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const accountId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
const controlAccountId = '123e4567-e89b-12d3-a456-426614174004' as TEntityId;

const validPayload: IBankAccountCreationReq = {
  name: 'Operating Bank Account',
  currencyCode: 'NGN',
  bankAccount: {
    bankName: 'First Bank of Nigeria',
    accountName: 'Company Operating Account',
    accountNumber: '0123456789',
  },
  openingBalance: null,
};

const accountingEntity = {
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  id: accountingEntityId,
  ownerId: userId,
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
} as IAccountingEntity;

const createdAccount: ILedgerAccountDto = {
  id: accountId,
  code: '100001',
  materializedPath: '100000.100001',
  accountingEntityId,
  type: 'asset',
  normalBalance: 'debit',
  subType: 'cash_and_cash_equivalent',
  behavior: 'bank',
  isControlAccount: false,
  controlAccountId,
  name: validPayload.name,
  status: 'active',
  contraAccountRule: 'contra_permitted',
  adjunctAccountRule: 'adjunct_permitted',
  openingBalanceDate: null,
  createdBy: userId,
  createdAt: new Date('2026-03-14T01:00:00.000Z'),
  updatedAt: new Date('2026-03-14T01:00:00.000Z'),
  balance: {
    amount: 0,
    currencyCode: 'NGN',
    isMinorUnit: true,
  },
  functionalBalance: {
    amount: 0,
    currencyCode: 'NGN',
    isMinorUnit: true,
  },
};

describe('POST /ledger/asset/bank', () => {
  let app: Express;
  const mockGetAuthUser = tokenService.getAuthUser as jest.Mock;
  const mockFindUser = userRepos.user.findById as jest.Mock;
  const mockFindAccountingEntity = accountingRepos.accountingEntity
    .findByIdAndUserId as jest.Mock;
  const mockCreateBankAccount =
    ledgerUseCases.createBankAccountUseCase as jest.Mock;

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
    mockCreateBankAccount.mockResolvedValue(createdAccount);
    app = createApplication();
  });

  const makeRequest = (payload: object = validPayload) =>
    request(app)
      .post(ENDPOINT)
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntityId)
      .send(payload);

  describe('201 Response', () => {
    it.each(['active', 'draft'] as const)(
      'accepts %s creation and returns its status',
      async (status) => {
        mockCreateBankAccount.mockResolvedValueOnce({
          ...createdAccount,
          status,
        });
        const response = await makeRequest({ ...validPayload, status });
        expect(response.status).toBe(201);
        expect(response.body.status).toBe(status);
        expect(mockCreateBankAccount).toHaveBeenCalledWith(
          expect.objectContaining({ status })
        );
      }
    );

    it('returns 201 with the created bank account DTO', async () => {
      const response = await makeRequest();

      expect(response.status).toBe(201);
      expect(response.type).toBe('application/json');
      expect(response.body).toEqual({
        ...createdAccount,
        openingBalanceDate: null,
        createdAt: createdAccount.createdAt.toISOString(),
        updatedAt: createdAccount.updatedAt.toISOString(),
      });
      expect(mockCreateBankAccount).toHaveBeenCalledWith(validPayload);
    });

    it('forwards an optional control account ID', async () => {
      const payload = { ...validPayload, controlAccountId };

      const response = await makeRequest(payload);

      expect(response.status).toBe(201);
      expect(mockCreateBankAccount).toHaveBeenCalledWith(payload);
    });
  });

  describe('404 Response', () => {
    it('maps the domain missing-control-account error to 404', async () => {
      mockCreateBankAccount.mockRejectedValueOnce(
        new ledgerAccountError.ControlAccountIdNotFound({
          id: controlAccountId,
        })
      );
      const response = await makeRequest({ ...validPayload, controlAccountId });
      expect(response.status).toBe(404);
      expect(response.body.errorKey).toBe(
        'ledger_error_control_account_id_not_found'
      );
    });
  });

  describe('409 Response', () => {
    it('maps a posting period failure', async () => {
      mockCreateBankAccount.mockRejectedValueOnce(
        new periodError.PostingPeriodNotOpen({
          accountingEntityId,
          postingDate: new Date('2026-03-14T00:00:00.000Z'),
        })
      );

      const response = await makeRequest();

      expect(response.status).toBe(409);
      expect(response.body.errorKey).toBe(
        'accounting_error_period_posting_period_not_open_conflict'
      );
    });

    it('maps a duplicate bank account conflict', async () => {
      mockCreateBankAccount.mockRejectedValueOnce(
        new ledgerAccountError.DuplicateBankAccount({
          bankName: validPayload.bankAccount.bankName,
          accountNumber: validPayload.bankAccount.accountNumber,
        })
      );

      const response = await makeRequest();

      expect(response.status).toBe(409);
      expect(response.body.errorKey).toBe(
        'ledger_error_asset_account_duplicate_bank_account_conflict'
      );
    });
  });

  describe('401 Response', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await request(app)
        .post(ENDPOINT)
        .set('x-accounting-entity-id', accountingEntityId)
        .send(validPayload);

      expect(response.status).toBe(401);
      expect(mockCreateBankAccount).not.toHaveBeenCalled();
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
      expect(mockCreateBankAccount).not.toHaveBeenCalled();
    });
  });

  describe('422 Response', () => {
    it.each(['archived', 'invalid'])(
      'rejects unsupported creation status %s',
      async (status) => {
        const response = await makeRequest({ ...validPayload, status });
        expect(response.status).toBe(422);
        expect(mockCreateBankAccount).not.toHaveBeenCalled();
      }
    );

    it('rejects invalid payload with extra fields', async () => {
      const invalidPayload = {
        ...validPayload,
        extraField: 'not allowed',
      };
      const response = await makeRequest(invalidPayload);

      expect(response.status).toBe(422);
      expect(response.body.errorKey).toBe('app_error_validation_error');
      expect(mockCreateBankAccount).not.toHaveBeenCalled();
    });
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
      expect(mockCreateBankAccount).not.toHaveBeenCalled();
    });

    it('sanitizes internal errors', async () => {
      mockCreateBankAccount.mockRejectedValueOnce(
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
