import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag-app.service.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import mockAccountCashFlowQueryRepo from '@app/reporting/contracts/__mocks__/account-cash-flow.query.repo.mock';

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
  getAccountCashFlowUseCase: jest
    .requireActual('@app/reporting/usecases/get-account-cash-flow.usecase')
    .default({
      appContext: jest.requireActual('@infra/services/app-context.service')
        .default,
      ledgerAccountRepo: jest.requireActual(
        '@app/ledger/contracts/__mocks__/ledger.repos.mock'
      ).mockLedgerAccountRepo,
      accountCashFlowQueryRepo: jest.requireActual(
        '@app/reporting/contracts/__mocks__/account-cash-flow.query.repo.mock'
      ).default,
    }),
}));

const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const accountId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
const endpoint = `/api/v1/reporting/accounts/${accountId}/cash-flow`;
const query = { from: '2026-10-01', to: '2026-10-12', bucketDays: 4 };
const account = {
  id: accountId,
  accountingEntityId: entityId,
  type: 'asset',
  subType: 'cash_and_cash_equivalent',
  behavior: 'bank',
  normalBalance: 'debit',
  isControlAccount: false,
  currency: SYSTEM_CURRENCIES.NGN,
  status: 'active',
  deletedAt: null,
  meta: null,
} as ILedgerAccount;
const entity = {
  id: entityId,
  ownerId: userId,
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
} as IAccountingEntity;

describe('GET /reporting/accounts/{accountId}/cash-flow', () => {
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
    mockAccountCashFlowQueryRepo.aggregateByAccount.mockResolvedValue([]);
    app = createApplication();
  });
  const getReport = (params = query, path = endpoint) =>
    request(app)
      .get(path)
      .query(params)
      .set('Authorization', 'Bearer test-token')
      .set('x-accounting-entity-id', entityId);

  describe('200 Response', () => {
    it('returns a complete chart and scopes the reads to the authorized entity', async () => {
      mockAccountCashFlowQueryRepo.aggregateByAccount.mockResolvedValue([
        { bucketIndex: 0, moneyIn: 300_000_00n, moneyOut: 250_000_00n },
        { bucketIndex: 1, moneyIn: 420_000_00n, moneyOut: 210_000_00n },
        { bucketIndex: 2, moneyIn: 480_000_00n, moneyOut: 320_000_00n },
      ]);
      const response = await getReport();
      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.body).toMatchObject({
        accountId,
        currencyCode: 'NGN',
        period: { from: query.from, to: query.to },
        totalMoneyIn: {
          amount: 1_200_000_00,
          currencyCode: 'NGN',
          isMinorUnit: true,
        },
        totalMoneyOut: {
          amount: 780_000_00,
          currencyCode: 'NGN',
          isMinorUnit: true,
        },
      });
      expect(response.body.buckets).toHaveLength(3);
      expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
        accountId,
        entityId,
        expect.any(Object)
      );
      expect(
        mockAccountCashFlowQueryRepo.aggregateByAccount
      ).toHaveBeenCalledWith(
        {
          accountId,
          accountingEntityId: entityId,
          currencyCode: 'NGN',
          from: new Date(query.from),
          to: new Date(query.to),
          bucketDays: query.bucketDays,
        },
        expect.any(Object)
      );
    });

    it('accepts archived petty cash and a zero-activity period', async () => {
      mockLedgerAccountRepo.findById.mockResolvedValue({
        ...account,
        behavior: 'petty_cash',
        status: 'archived',
      });
      const response = await getReport();
      expect(response.status).toBe(200);
      expect(response.body.totalMoneyIn.amount).toBe(0);
      expect(response.body.buckets).toHaveLength(3);
    });
  });

  describe('400 Response', () => {
    it('rejects 367 days before querying aggregates', async () => {
      const response = await getReport({
        from: '2024-01-01',
        to: '2025-01-01',
        bucketDays: 4,
      });
      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe(
        'app_error_reporting_period_limit_invalid'
      );
      expect(
        mockAccountCashFlowQueryRepo.aggregateByAccount
      ).not.toHaveBeenCalled();
    });

    it('rejects an invalid account ID', async () => {
      const response = await getReport(
        query,
        '/api/v1/reporting/accounts/bad-id/cash-flow'
      );
      expect(response.status).toBe(400);
      expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
    });

    it('rejects unsupported account types', async () => {
      mockLedgerAccountRepo.findById.mockResolvedValue({
        ...account,
        subType: 'receivables',
      });
      expect((await getReport()).status).toBe(400);
      expect(
        mockAccountCashFlowQueryRepo.aggregateByAccount
      ).not.toHaveBeenCalled();
    });

    it('rejects either gross total above the currency cap without a partial response', async () => {
      mockAccountCashFlowQueryRepo.aggregateByAccount.mockResolvedValue([
        { bucketIndex: 0, moneyIn: 0n, moneyOut: 100_000_000_000_001n },
      ]);
      const response = await getReport();
      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe(
        'app_error_reporting_amount_limit_invalid'
      );
      expect(response.body).not.toHaveProperty('buckets');
    });
  });

  describe('401 Response', () => {
    it('requires authentication', async () => {
      const response = await request(app)
        .get(endpoint)
        .query(query)
        .set('x-accounting-entity-id', entityId);
      expect(response.status).toBe(401);
      expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('enforces the existing feature gate', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(false);
      expect((await getReport()).status).toBe(403);
      expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
    });
    it('rejects a foreign accounting entity', async () => {
      jest
        .mocked(accountingRepos.accountingEntity.findByIdAndUserId)
        .mockResolvedValue({ ...entity, ownerId: accountId });
      expect((await getReport()).status).toBe(403);
      expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
    });
  });

  describe('404 Response', () => {
    it('does not distinguish a missing account from one outside the active entity', async () => {
      mockLedgerAccountRepo.findById.mockResolvedValue(null);
      const response = await getReport();
      expect(response.status).toBe(404);
      expect(response.body.errorKey).toBe(
        'app_error_reporting_account_not_found'
      );
      expect(
        mockAccountCashFlowQueryRepo.aggregateByAccount
      ).not.toHaveBeenCalled();
    });
  });

  describe('422 Response', () => {
    it.each([{ from: '2026-02-30' }, { bucketDays: 0 }, { bucketDays: 1.5 }])(
      'rejects malformed query values %j',
      async (invalid) => {
        expect((await getReport({ ...query, ...invalid })).status).toBe(422);
        expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
      }
    );
    it('requires the complete query', async () => {
      const response = await request(app)
        .get(endpoint)
        .set('Authorization', 'Bearer test-token')
        .set('x-accounting-entity-id', entityId);
      expect(response.status).toBe(422);
      expect(
        mockAccountCashFlowQueryRepo.aggregateByAccount
      ).not.toHaveBeenCalled();
    });
  });

  describe('500 Response', () => {
    it('reports and sanitizes unsafe representation without serializing bigint causes', async () => {
      const reporter = jest
        .spyOn(observability.reporter, 'report')
        .mockImplementation(() => {});
      mockLedgerAccountRepo.findById.mockResolvedValue({
        ...account,
        currency: { ...SYSTEM_CURRENCIES.NGN, minorUnit: 4 },
      });
      mockAccountCashFlowQueryRepo.aggregateByAccount.mockResolvedValue([
        { bucketIndex: 0, moneyIn: 9007199254740993n, moneyOut: 0n },
      ]);
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
