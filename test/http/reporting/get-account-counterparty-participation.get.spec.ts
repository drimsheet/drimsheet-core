import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { ILedgerAccountBalance } from '@domain/ledger/types/ledger-account-balance.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';
import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag-app.service.mock';
import {
  mockLedgerAccountBalanceRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import mockAccountCounterpartyParticipationQueryRepo from '@app/reporting/contracts/__mocks__/account-counterparty-participation.query.repo.mock';

import { tokenAppService } from '@infra/ioc/services/auth';
import observability from '@infra/observability';
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
  featureFlagAppService: jest.requireActual(
    '@app/context/contracts/__mocks__/feature-flag-app.service.mock'
  ).default,
}));
jest.mock('@infra/ioc/services/auth', () => ({
  __esModule: true,
  tokenAppService: { getAuthUser: jest.fn() },
}));
jest.mock('@infra/persistence/repos/accounting', () => ({
  __esModule: true,
  default: {
    accountingEntity: jest.requireActual(
      '@app/accounting/contracts/__mocks__/accounting.repos.mock'
    ).mockAccountingEntityRepo,
  },
}));
jest.mock('@infra/persistence/repos/user', () => ({
  __esModule: true,
  default: {
    user: jest.requireActual('@app/user/contracts/__mocks__/user.repos.mock')
      .mockUserRepo,
  },
}));
// Exercise the real controller, use case and policy with only read ports mocked.
jest.mock('@infra/ioc/usecases/reporting', () => ({
  getAccountCounterpartyParticipationUseCase: jest
    .requireActual(
      '@app/reporting/usecases/get-account-counterparty-participation.usecase'
    )
    .default({
      appContext: jest.requireActual('@infra/services/app-context.service')
        .default,
      ledgerAccountRepo: jest.requireActual(
        '@app/ledger/contracts/__mocks__/ledger.repos.mock'
      ).mockLedgerAccountRepo,
      ledgerAccountBalanceRepo: jest.requireActual(
        '@app/ledger/contracts/__mocks__/ledger.repos.mock'
      ).mockLedgerAccountBalanceRepo,
      accountCounterpartyParticipationQueryRepo: jest.requireActual(
        '@app/reporting/contracts/__mocks__/account-counterparty-participation.query.repo.mock'
      ).default,
    }),
}));

const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const accountId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
const endpoint = `/api/v1/reporting/accounts/${accountId}/counterparty-participation`;
const entity = {
  id: entityId,
  ownerId: userId,
  name: 'My Books',
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
} as IAccountingEntity;
const account = {
  id: accountId,
  accountingEntityId: entityId,
  currency: null,
  isControlAccount: true,
} as ILedgerAccount;
const balance = {
  ledgerAccountId: accountId,
  amount: moneyValue.make(10000n, SYSTEM_CURRENCIES.NGN, true),
  functionalAmount: moneyValue.make(10000n, SYSTEM_CURRENCIES.NGN, true),
} as ILedgerAccountBalance;
const aggregate = {
  counterparty: null,
  isSelf: true,
  normalBalance: 'debit' as const,
  debits: 4000n,
  credits: 1000n,
  functionalDebits: 4000n,
  functionalCredits: 1000n,
};

describe('GET /reporting/accounts/{accountId}/counterparty-participation', () => {
  let app: Express;
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(tokenAppService.getAuthUser).mockResolvedValue({ id: userId });
    jest
      .mocked(userRepos.user.findById)
      .mockResolvedValue({ id: userId, actorId: userId } as IUser);
    jest
      .mocked(accountingRepos.accountingEntity.findByIdAndUserId)
      .mockResolvedValue(entity);
    mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(true);
    mockLedgerAccountRepo.findById.mockResolvedValue(account);
    mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValue(balance);
    mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount.mockResolvedValue(
      [aggregate]
    );
    app = createApplication();
  });
  const getReport = (
    query: Record<string, string | number | undefined> = {},
    path = endpoint
  ) =>
    request(app)
      .get(path)
      .query(query)
      .set('Authorization', 'Bearer test-token')
      .set('x-accounting-entity-id', entityId);

  describe('200 Response', () => {
    it('returns paginated participation with stored-balance shares and null self counterparties', async () => {
      const response = await getReport();
      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.body).toEqual({
        data: [
          {
            counterparty: null,
            isSelf: true,
            participation: {
              amount: { amount: 3000, currencyCode: 'NGN', isMinorUnit: true },
              functionalAmount: {
                amount: 3000,
                currencyCode: 'NGN',
                isMinorUnit: true,
              },
              totalShare: 30,
            },
          },
        ],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });
      expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
        accountId,
        entityId,
        expect.any(Object)
      );
      expect(mockLedgerAccountBalanceRepo.findByAccountId).toHaveBeenCalledWith(
        accountId,
        entityId,
        expect.any(Object)
      );
      expect(
        mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount
      ).toHaveBeenCalledWith(
        {
          accountId,
          accountingEntityId: entityId,
          functionalCurrencyCode: 'NGN',
        },
        expect.any(Object)
      );
    });

    it('accepts numeric pagination and case-insensitive entity-name search without changing shares', async () => {
      mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount.mockResolvedValue(
        [aggregate, { ...aggregate, isSelf: false }]
      );
      const response = await getReport({
        search: 'MY books',
        page: 1,
        limit: 1,
      });
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].participation.totalShare).toBe(30);
      expect(response.body.meta).toEqual({
        page: 1,
        limit: 1,
        total: 1,
        totalPages: 1,
      });
    });

    it('returns null shares at zero balance and an empty envelope without contributions', async () => {
      mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValue({
        ...balance,
        amount: moneyValue.makeZeroAmount(SYSTEM_CURRENCIES.NGN),
      });
      const response = await getReport();
      expect(response.status).toBe(200);
      expect(response.body.data[0].participation.totalShare).toBeNull();
      mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount.mockResolvedValue(
        []
      );
      expect((await getReport()).body).toEqual({
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      });
    });
  });

  describe('400 Response', () => {
    it('rejects malformed account IDs before querying storage', async () => {
      const response = await getReport(
        {},
        endpoint.replace(accountId, 'invalid')
      );
      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe(
        'app_error_reporting_account_id_invalid'
      );
      expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
    });

    it('enforces the reporting amount ceiling', async () => {
      mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount.mockResolvedValue(
        [{ ...aggregate, debits: 100_000_000_001_001n }]
      );
      const response = await getReport();
      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe(
        'app_error_reporting_amount_limit_invalid'
      );
    });
  });

  describe('401 Response', () => {
    it('requires authentication before reading the account', async () => {
      expect(
        (
          await request(app)
            .get(endpoint)
            .set('x-accounting-entity-id', entityId)
        ).status
      ).toBe(401);
      expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('requires feature access', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(false);
      expect((await getReport()).status).toBe(403);
      expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
    });

    it('requires ownership of the accounting entity', async () => {
      jest
        .mocked(accountingRepos.accountingEntity.findByIdAndUserId)
        .mockResolvedValue({ ...entity, ownerId: entityId });
      expect((await getReport()).status).toBe(403);
      expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
    });
  });

  describe('404 Response', () => {
    it('does not reveal missing or foreign accounts', async () => {
      mockLedgerAccountRepo.findById.mockResolvedValue(null);
      const response = await getReport();
      expect(response.status).toBe(404);
      expect(response.body.errorKey).toBe(
        'app_error_reporting_account_not_found'
      );
      expect(
        mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount
      ).not.toHaveBeenCalled();
    });

    it('returns the existing missing-balance error without fabricating shares', async () => {
      mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValue(null);
      const response = await getReport();
      expect(response.status).toBe(404);
      expect(response.body.errorKey).toBe('app_error_ledger_balance_not_found');
      expect(
        mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount
      ).not.toHaveBeenCalled();
    });
  });

  describe('422 Response', () => {
    it.each([
      { page: 0 },
      { page: 1.5 },
      { limit: 201 },
      { limit: 1.5 },
      { page: 'invalid' },
    ])(
      'rejects invalid pagination %j before reading storage',
      async (query) => {
        expect((await getReport(query)).status).toBe(422);
        expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
      }
    );
  });

  describe('500 Response', () => {
    it('sanitizes storage failures without returning a partial report', async () => {
      const reporter = jest
        .spyOn(observability.reporter, 'report')
        .mockImplementation(() => {});
      mockAccountCounterpartyParticipationQueryRepo.aggregateByAccount.mockRejectedValue(
        new Error('storage unavailable')
      );
      try {
        const response = await getReport();
        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          name: 'InternalServerError',
          errorKey: 'app_error_unexpected',
        });
        expect(reporter).toHaveBeenCalledTimes(1);
      } finally {
        reporter.mockRestore();
      }
    });
  });
});
