import { Server } from 'node:http';

import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag-app.service.mock';

import { tokenAppService } from '@infra/ioc/services/auth';
import observability from '@infra/observability';
import accountingRepos from '@infra/persistence/repos/accounting';
import revenueExpenseAndSuspenseAccountBalancesRepoQuery from '@infra/persistence/repos/ledger/queries/revenue-expense-and-suspense-account-balances.reporting';
import userRepos from '@infra/persistence/repos/user';

import createApplication from '@interface/http/application';

import { closeTestServer, startTestServer } from '../../../setup/http-listener';

jest.mock(
  '@infra/persistence/repos/ledger/queries/revenue-expense-and-suspense-account-balances.reporting',
  () => ({ __esModule: true, default: jest.fn() })
);
const mockRevenueExpenseAndSuspenseAccountBalancesRepoQuery = jest.mocked(
  revenueExpenseAndSuspenseAccountBalancesRepoQuery
);

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
// Exercise the real controller and use case with only read ports mocked.
jest.mock('@infra/ioc/usecases/ledger.reporting', () => ({
  getRevenueExpenseAndSuspenseAccountBalancesUseCase: jest
    .requireActual(
      '@app/ledger/usecases/reporting/revenue-expense-and-suspense-account-balances/revenue-expense-and-suspense-account-balances.usecase'
    )
    .default({
      appContext: jest.requireActual('@infra/services/app-context.service')
        .default,
      repoQuery: jest.requireMock(
        '@infra/persistence/repos/ledger/queries/revenue-expense-and-suspense-account-balances.reporting'
      ).default,
    }),
}));

const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const endpoint =
  '/api/v1/reporting/ledger/revenue-expense-and-suspense-account-balances';
const entity = {
  id: entityId,
  ownerId: userId,
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
} as IAccountingEntity;
const account = {
  accountId: 'sales',
  accountName: 'Sales',
  code: '400001',
  type: 'revenue' as const,
  subType: 'sales',
  status: 'active' as const,
  isControlAccount: false,
  controlAccountId: 'sales-header',
  functionalBalance: 80000n,
  transactionCount: 128n,
};

const header = {
  ...account,
  accountId: 'sales-header',
  code: '400000',
  isControlAccount: true,
  controlAccountId: null,
  functionalBalance: 100000n,
  transactionCount: 0n,
};

describe('GET /reporting/ledger/revenue-expense-and-suspense-account-balances', () => {
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
    mockRevenueExpenseAndSuspenseAccountBalancesRepoQuery.mockResolvedValue([]);
    app = createApplication();
    server = await startTestServer(app);
  });

  afterEach(async () => {
    await closeTestServer(server);
  });
  const getReport = (query: Record<string, string | number | undefined> = {}) =>
    request(server)
      .get(endpoint)
      .query(query)
      .set('Authorization', 'Bearer test-token')
      .set('x-accounting-entity-id', entityId);

  describe('200 Response', () => {
    it('returns posting rows including suspense and excludes headers without requiring dates', async () => {
      mockRevenueExpenseAndSuspenseAccountBalancesRepoQuery.mockResolvedValue([
        header,
        {
          ...header,
          accountId: 'expense-header',
          type: 'expense',
          code: '500000',
          functionalBalance: 40000n,
        },
        account,
        { ...account, accountId: 'other', functionalBalance: 20000n },
        {
          ...account,
          accountId: 'rent',
          type: 'expense',
          subType: 'rent_and_utilities',
          functionalBalance: 40000n,
        },
        {
          ...account,
          accountId: 'suspense',
          controlAccountId: null,
          accountName: 'Uncategorized',
          type: 'liability',
          subType: 'suspense',
          functionalBalance: 10000n,
        },
      ]);
      const response = await getReport();
      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.body.meta).toEqual({
        page: 1,
        limit: 10,
        total: 4,
        totalPages: 1,
      });
      expect(response.body.data[0]).toEqual({
        accountId: 'sales',
        accountName: 'Sales',
        code: '400001',
        type: 'revenue',
        subType: 'sales',
        status: 'active',
        amount: { amount: 80000, currencyCode: 'NGN', isMinorUnit: true },
        sharePercentage: 80,
        transactionCount: 128,
      });
      expect(response.body.data[3]).toMatchObject({
        accountId: 'suspense',
        type: 'liability',
        subType: 'suspense',
        sharePercentage: null,
      });
      expect(
        mockRevenueExpenseAndSuspenseAccountBalancesRepoQuery
      ).toHaveBeenCalledWith(
        { accountingEntityId: entityId, currencyCode: 'NGN' },
        expect.any(Object)
      );
    });

    it('accepts search, type and numeric pagination while preserving the full denominator', async () => {
      mockRevenueExpenseAndSuspenseAccountBalancesRepoQuery.mockResolvedValue([
        header,
        {
          ...header,
          accountId: 'expense-header',
          type: 'expense',
          code: '500000',
          functionalBalance: 40000n,
        },
        account,
        {
          ...account,
          accountId: 'other',
          accountName: 'Other',
          functionalBalance: 20000n,
        },
      ]);
      const response = await getReport({
        search: 'sales',
        type: 'revenue',
        page: 1,
        limit: 1,
      });
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].sharePercentage).toBe(80);
      expect(response.body.meta).toEqual({
        page: 1,
        limit: 1,
        total: 1,
        totalPages: 1,
      });
    });

    it('returns an empty page for an entity without these accounts', async () => {
      const response = await getReport();
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      });
    });
  });

  describe('400 Response', () => {
    it('enforces the existing reporting amount ceiling', async () => {
      mockRevenueExpenseAndSuspenseAccountBalancesRepoQuery.mockResolvedValue([
        { ...account, functionalBalance: 100_000_000_000_001n },
      ]);
      const response = await getReport();
      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe(
        'app_error_reporting_amount_limit_invalid'
      );
    });
  });

  describe('401 Response', () => {
    it('requires authentication before querying storage', async () => {
      expect(
        (
          await request(server)
            .get(endpoint)
            .set('x-accounting-entity-id', entityId)
        ).status
      ).toBe(401);
      expect(
        mockRevenueExpenseAndSuspenseAccountBalancesRepoQuery
      ).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('requires feature access', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(false);
      expect((await getReport()).status).toBe(403);
      expect(
        mockRevenueExpenseAndSuspenseAccountBalancesRepoQuery
      ).not.toHaveBeenCalled();
    });

    it('requires ownership of the accounting entity', async () => {
      jest
        .mocked(accountingRepos.accountingEntity.findByIdAndUserId)
        .mockResolvedValue({ ...entity, ownerId: entityId });
      expect((await getReport()).status).toBe(403);
      expect(
        mockRevenueExpenseAndSuspenseAccountBalancesRepoQuery
      ).not.toHaveBeenCalled();
    });
  });

  describe('422 Response', () => {
    it.each([
      { type: 'asset' },
      { page: 0 },
      { page: 1.5 },
      { limit: 201 },
      { limit: 1.5 },
      { page: 'invalid' },
    ])('rejects invalid filters %j before querying storage', async (query) => {
      expect((await getReport(query)).status).toBe(422);
      expect(
        mockRevenueExpenseAndSuspenseAccountBalancesRepoQuery
      ).not.toHaveBeenCalled();
    });
  });

  describe('500 Response', () => {
    it('sanitizes unsafe transaction counts', async () => {
      const reporter = jest
        .spyOn(observability.reporter, 'report')
        .mockImplementation(() => {});
      mockRevenueExpenseAndSuspenseAccountBalancesRepoQuery.mockResolvedValue([
        { ...account, transactionCount: 9007199254740993n },
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
