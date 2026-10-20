import { Server } from 'node:http';

import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag-app.service.mock';
import mockRevenueExpenseSummaryQueryRepo from '@app/reporting/contracts/__mocks__/revenue-expense-summary.query.repo.mock';

import { tokenAppService } from '@infra/ioc/services/auth';
import observability from '@infra/observability';
import accountingRepos from '@infra/persistence/repos/accounting';
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
// Exercise the real controller, use case and reporting helper with only read ports mocked.
jest.mock('@infra/ioc/usecases/reporting', () => ({
  getRevenueExpenseSummaryUseCase: jest
    .requireActual(
      '@app/reporting/usecases/get-revenue-expense-summary.usecase'
    )
    .default({
      appContext: jest.requireActual('@infra/services/app-context.service')
        .default,
      revenueExpenseSummaryQueryRepo: jest.requireActual(
        '@app/reporting/contracts/__mocks__/revenue-expense-summary.query.repo.mock'
      ).default,
    }),
}));

const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const endpoint = '/api/v1/reporting/revenue-expense-summary';
const query = { from: '2026-10-01', to: '2026-10-14' };
const entity = {
  id: entityId,
  ownerId: userId,
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
} as IAccountingEntity;

describe('GET /reporting/revenue-expense-summary', () => {
  let app: Express;
  let server: Server;
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.mocked(tokenAppService.getAuthUser).mockResolvedValue({ id: userId });
    jest
      .mocked(userRepos.user.findById)
      .mockResolvedValue({ id: userId, actorId: userId } as IUser);
    jest
      .mocked(accountingRepos.accountingEntity.findByIdAndUserId)
      .mockResolvedValue(entity);
    mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(true);
    mockRevenueExpenseSummaryQueryRepo.aggregate.mockResolvedValue({
      accounts: [],
      suspense: { transactionCount: 0n, amount: 0n },
    });
    app = createApplication();
    server = await startTestServer(app);
  });

  afterEach(async () => {
    await closeTestServer(server);
  });
  const getReport = (params = query) =>
    request(server)
      .get(endpoint)
      .query(params)
      .set('Authorization', 'Bearer test-token')
      .set('x-accounting-entity-id', entityId);

  describe('200 Response', () => {
    it('returns the screenshot totals, account breakdowns and suspense card in one response', async () => {
      const revenue = [
        ['products', 'Product sales', 8_400_000_00n],
        ['services', 'Services', 3_100_000_00n],
        ['other', 'Other income', 900_000_00n],
      ] as const;
      const expenses = [
        ['cogs', 'Cost of goods sold', 3_600_000_00n],
        ['salaries', 'Salaries & wages', 2_400_000_00n],
        ['rent', 'Rent', 1_200_000_00n],
        ['marketing', 'Marketing', 600_000_00n],
        ['utilities', 'Utilities', 300_000_00n],
      ] as const;
      mockRevenueExpenseSummaryQueryRepo.aggregate.mockResolvedValue({
        accounts: [
          ...revenue.map(([accountId, accountName, credits]) => ({
            accountId,
            accountName,
            type: 'revenue' as const,
            credits,
            debits: 0n,
            previousCredits: 0n,
            previousDebits: 0n,
          })),
          ...expenses.map(([accountId, accountName, debits]) => ({
            accountId,
            accountName,
            type: 'expense' as const,
            debits,
            credits: 0n,
            previousCredits: 0n,
            previousDebits: 0n,
          })),
        ],
        suspense: { transactionCount: 12n, amount: 450_000_00n },
      });
      const response = await getReport();
      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.body).toMatchObject({
        currencyCode: 'NGN',
        period: query,
        comparisonPeriod: { from: '2026-09-17', to: '2026-09-30' },
        revenue: {
          total: {
            amount: 12_400_000_00,
            currencyCode: 'NGN',
            isMinorUnit: true,
          },
          percentageChange: null,
        },
        expenses: {
          total: {
            amount: 8_100_000_00,
            currencyCode: 'NGN',
            isMinorUnit: true,
          },
        },
        suspense: {
          transactionCount: 12,
          amount: {
            amount: 450_000_00,
            currencyCode: 'NGN',
            isMinorUnit: true,
          },
        },
      });
      expect(response.body.revenue.accounts).toHaveLength(3);
      expect(response.body.revenue.accounts[0]).toEqual({
        accountId: 'products',
        accountName: 'Product sales',
        amount: {
          amount: 8_400_000_00,
          currencyCode: 'NGN',
          isMinorUnit: true,
        },
        sharePercentage: 67.74,
      });
      expect(response.body.expenses.accounts).toHaveLength(5);
      expect(response.body.expenses.accounts[0].sharePercentage).toBe(44.44);
      expect(mockRevenueExpenseSummaryQueryRepo.aggregate).toHaveBeenCalledWith(
        {
          accountingEntityId: entityId,
          currencyCode: 'NGN',
          period: { from: new Date(query.from), to: new Date(query.to) },
          comparisonPeriod: {
            from: new Date('2026-09-17'),
            to: new Date('2026-09-30'),
          },
        },
        expect.any(Object)
      );
    });

    it('returns an empty overview in the accounting entity currency', async () => {
      jest
        .mocked(accountingRepos.accountingEntity.findByIdAndUserId)
        .mockResolvedValue({ ...entity, functionalCurrencyCode: 'USD' });
      const response = await getReport();
      expect(response.status).toBe(200);
      expect(response.body.currencyCode).toBe('USD');
      expect(response.body.revenue.accounts).toEqual([]);
      expect(response.body.expenses.total.amount).toBe(0);
      expect(response.body.suspense.transactionCount).toBe(0);
    });
  });

  describe('400 Response', () => {
    it.each([
      { from: '2026-10-14', to: '2026-10-01' },
      { from: '2024-01-01', to: '2025-01-01' },
      { from: '0001-01-01', to: '0001-01-01' },
    ])(
      'rejects unsupported periods %j before reading aggregates',
      async (invalid) => {
        expect((await getReport(invalid)).status).toBe(400);
        expect(
          mockRevenueExpenseSummaryQueryRepo.aggregate
        ).not.toHaveBeenCalled();
      }
    );

    it('rejects amounts above the report ceiling', async () => {
      mockRevenueExpenseSummaryQueryRepo.aggregate.mockResolvedValue({
        accounts: [],
        suspense: { transactionCount: 1n, amount: 100_000_000_000_001n },
      });
      const response = await getReport();
      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe(
        'app_error_reporting_amount_limit_invalid'
      );
    });
  });

  describe('401 Response', () => {
    it('requires authentication before reading aggregates', async () => {
      const response = await request(server)
        .get(endpoint)
        .query(query)
        .set('x-accounting-entity-id', entityId);
      expect(response.status).toBe(401);
      expect(
        mockRevenueExpenseSummaryQueryRepo.aggregate
      ).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('enforces the existing feature gate', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(false);
      expect((await getReport()).status).toBe(403);
      expect(
        mockRevenueExpenseSummaryQueryRepo.aggregate
      ).not.toHaveBeenCalled();
    });

    it('rejects an accounting entity owned by another user', async () => {
      jest
        .mocked(accountingRepos.accountingEntity.findByIdAndUserId)
        .mockResolvedValue({ ...entity, ownerId: entityId });
      expect((await getReport()).status).toBe(403);
      expect(
        mockRevenueExpenseSummaryQueryRepo.aggregate
      ).not.toHaveBeenCalled();
    });
  });

  describe('422 Response', () => {
    it.each([{ from: '2026-02-30' }, { to: 'not-a-date' }])(
      'rejects malformed dates %j',
      async (invalid) => {
        expect((await getReport({ ...query, ...invalid })).status).toBe(422);
        expect(
          mockRevenueExpenseSummaryQueryRepo.aggregate
        ).not.toHaveBeenCalled();
      }
    );

    it('requires both dates', async () => {
      const response = await request(server)
        .get(endpoint)
        .set('Authorization', 'Bearer test-token')
        .set('x-accounting-entity-id', entityId);
      expect(response.status).toBe(422);
      expect(
        mockRevenueExpenseSummaryQueryRepo.aggregate
      ).not.toHaveBeenCalled();
    });
  });

  describe('500 Response', () => {
    it('sanitizes and reports unsafe counts without returning partial data', async () => {
      const reporter = jest
        .spyOn(observability.reporter, 'report')
        .mockImplementation(() => {});
      mockRevenueExpenseSummaryQueryRepo.aggregate.mockResolvedValue({
        accounts: [],
        suspense: { transactionCount: 9007199254740993n, amount: 0n },
      });
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
