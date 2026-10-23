import { Server } from 'node:http';

import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag-app.service.mock';
import mockAssetLiabilitySummaryQueryRepo from '@app/reporting/contracts/__mocks__/asset-liability-summary.query.repo.mock';

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
// Exercise the assembled HTTP boundary with only external read ports mocked.
jest.mock('@infra/ioc/usecases/reporting', () => ({
  getAssetLiabilitySummaryUseCase: jest
    .requireActual(
      '@app/reporting/usecases/get-asset-liability-summary.usecase'
    )
    .default({
      appContext: jest.requireActual('@infra/services/app-context.service')
        .default,
      assetLiabilitySummaryQueryRepo: jest.requireActual(
        '@app/reporting/contracts/__mocks__/asset-liability-summary.query.repo.mock'
      ).default,
    }),
}));

const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const endpoint = '/api/v1/reporting/asset-liability-summary';
const query = { from: '2026-10-01', to: '2026-10-14' };
const entity = {
  id: entityId,
  ownerId: userId,
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
} as IAccountingEntity;

describe('GET /reporting/asset-liability-summary', () => {
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
    mockAssetLiabilitySummaryQueryRepo.aggregate.mockResolvedValue({
      balances: [],
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
    it('returns all card balances and net asset change in functional minor units', async () => {
      mockAssetLiabilitySummaryQueryRepo.aggregate.mockResolvedValue({
        balances: [
          {
            type: 'asset',
            debits: 15_680_000_00n,
            credits: 0n,
            previousDebits: 13_600_000_00n,
            previousCredits: 0n,
          },
          {
            type: 'liability',
            debits: 0n,
            credits: 3_200_000_00n,
            previousDebits: 0n,
            previousCredits: 3_200_000_00n,
          },
        ],
      });
      const response = await getReport();
      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.body).toMatchObject({
        currencyCode: 'NGN',
        period: query,
        comparisonPeriod: { from: '2026-09-17', to: '2026-09-30' },
        assets: {
          total: {
            amount: 15_680_000_00,
            currencyCode: 'NGN',
            isMinorUnit: true,
          },
        },
        liabilities: {
          total: {
            amount: 3_200_000_00,
            currencyCode: 'NGN',
            isMinorUnit: true,
          },
        },
        netAssets: {
          total: {
            amount: 12_480_000_00,
            currencyCode: 'NGN',
            isMinorUnit: true,
          },
          previousTotal: {
            amount: 10_400_000_00,
            currencyCode: 'NGN',
            isMinorUnit: true,
          },
          change: {
            amount: 2_080_000_00,
            currencyCode: 'NGN',
            isMinorUnit: true,
          },
          percentageChange: 20,
        },
      });
      expect(mockAssetLiabilitySummaryQueryRepo.aggregate).toHaveBeenCalledWith(
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

    it('returns zero balances and null comparisons in the entity currency', async () => {
      jest
        .mocked(accountingRepos.accountingEntity.findByIdAndUserId)
        .mockResolvedValue({ ...entity, functionalCurrencyCode: 'USD' });
      const response = await getReport();
      expect(response.status).toBe(200);
      expect(response.body.currencyCode).toBe('USD');
      for (const section of ['assets', 'liabilities', 'netAssets']) {
        expect(response.body[section]).toEqual({
          total: { amount: 0, currencyCode: 'USD', isMinorUnit: true },
          previousTotal: { amount: 0, currencyCode: 'USD', isMinorUnit: true },
          change: { amount: 0, currencyCode: 'USD', isMinorUnit: true },
          percentageChange: null,
        });
      }
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
          mockAssetLiabilitySummaryQueryRepo.aggregate
        ).not.toHaveBeenCalled();
      }
    );

    it('rejects amounts above the report ceiling', async () => {
      mockAssetLiabilitySummaryQueryRepo.aggregate.mockResolvedValue({
        balances: [
          {
            type: 'asset',
            debits: 100_000_000_000_001n,
            credits: 0n,
            previousDebits: 0n,
            previousCredits: 0n,
          },
        ],
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
        mockAssetLiabilitySummaryQueryRepo.aggregate
      ).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('enforces the existing feature gate', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(false);
      expect((await getReport()).status).toBe(403);
      expect(
        mockAssetLiabilitySummaryQueryRepo.aggregate
      ).not.toHaveBeenCalled();
    });

    it('rejects an accounting entity owned by another user', async () => {
      jest
        .mocked(accountingRepos.accountingEntity.findByIdAndUserId)
        .mockResolvedValue({ ...entity, ownerId: entityId });
      expect((await getReport()).status).toBe(403);
      expect(
        mockAssetLiabilitySummaryQueryRepo.aggregate
      ).not.toHaveBeenCalled();
    });
  });

  describe('422 Response', () => {
    it.each([{ from: '2026-02-30' }, { to: 'not-a-date' }])(
      'rejects malformed dates %j',
      async (invalid) => {
        expect((await getReport({ ...query, ...invalid })).status).toBe(422);
        expect(
          mockAssetLiabilitySummaryQueryRepo.aggregate
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
        mockAssetLiabilitySummaryQueryRepo.aggregate
      ).not.toHaveBeenCalled();
    });
  });

  describe('500 Response', () => {
    it('sanitizes and reports storage failures without returning partial data', async () => {
      const reporter = jest
        .spyOn(observability.reporter, 'report')
        .mockImplementation(() => {});
      mockAssetLiabilitySummaryQueryRepo.aggregate.mockRejectedValue(
        new Error('private database details')
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
