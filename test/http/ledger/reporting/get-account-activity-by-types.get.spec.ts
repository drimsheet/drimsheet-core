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
import accountActivityByTypesRepoQuery from '@infra/persistence/repos/ledger/queries/account-activity-by-types.reporting';
import userRepos from '@infra/persistence/repos/user';

import createApplication from '@interface/http/application';

import { closeTestServer, startTestServer } from '../../../setup/http-listener';

jest.mock(
  '@infra/persistence/repos/ledger/queries/account-activity-by-types.reporting',
  () => ({ __esModule: true, default: jest.fn() })
);
const mockAccountActivityByTypesRepoQuery = jest.mocked(
  accountActivityByTypesRepoQuery
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
// Exercise real HTTP and application behavior with read ports mocked.
jest.mock('@infra/ioc/usecases/ledger.reporting', () => ({
  getAccountActivityByTypesUseCase: jest
    .requireActual(
      '@app/ledger/usecases/reporting/account-activity-by-types/account-activity-by-types.usecase'
    )
    .default({
      appContext: jest.requireActual('@infra/services/app-context.service')
        .default,
      repoQuery: jest.requireMock(
        '@infra/persistence/repos/ledger/queries/account-activity-by-types.reporting'
      ).default,
    }),
}));

const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const endpoint = '/api/v1/reporting/ledger/account-activity-by-types';
const query = {
  from: '2026-10-01',
  to: '2026-10-02',
  bucketDays: 1,
  types: ['revenue', 'expense'],
};
const money = (amount: number) => ({
  amount,
  currencyCode: 'NGN',
  isMinorUnit: true,
});
const entity = {
  id: entityId,
  ownerId: userId,
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
} as IAccountingEntity;

describe('GET /reporting/ledger/account-activity-by-types', () => {
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
    mockAccountActivityByTypesRepoQuery.mockResolvedValue([]);
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
    it('returns daily functional activity, signed deltas and zero buckets', async () => {
      mockAccountActivityByTypesRepoQuery.mockResolvedValue([
        { type: 'revenue', bucketIndex: 0, debits: 150n, credits: 100n },
      ]);
      const response = await getReport();
      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.body.period).toEqual({ from: query.from, to: query.to });
      expect(response.body.currencyCode).toBe('NGN');
      expect(response.body.buckets).toHaveLength(2);
      expect(response.body.buckets[0]).toEqual({
        from: '2026-10-01',
        to: '2026-10-01',
        activity: [
          {
            type: 'expense',
            totalDebits: money(0),
            totalCredits: money(0),
            delta: money(0),
          },
          {
            type: 'revenue',
            totalDebits: money(150),
            totalCredits: money(100),
            delta: money(-50),
          },
        ],
      });
      expect(response.body.buckets[1].activity[1].delta).toEqual(money(0));
      expect(mockAccountActivityByTypesRepoQuery).toHaveBeenCalledWith(
        {
          accountingEntityId: entityId,
          currencyCode: 'NGN',
          period: { from: new Date(query.from), to: new Date(query.to) },
          bucketDays: 1,
          types: ['expense', 'revenue'],
        },
        expect.any(Object)
      );
    });

    it('returns zero activity in the entity functional currency', async () => {
      jest
        .mocked(accountingRepos.accountingEntity.findByIdAndUserId)
        .mockResolvedValue({ ...entity, functionalCurrencyCode: 'USD' });
      const response = await getReport();
      expect(response.status).toBe(200);
      expect(response.body.buckets[0].activity[0].delta).toEqual({
        amount: 0,
        currencyCode: 'USD',
        isMinorUnit: true,
      });
    });
  });

  describe('400 Response', () => {
    it.each([
      { from: '2026-10-14', to: '2026-10-01' },
      { from: '2024-01-01', to: '2025-01-01' },
    ])('rejects unsupported periods %j', async (invalid) => {
      expect((await getReport({ ...query, ...invalid })).status).toBe(400);
      expect(mockAccountActivityByTypesRepoQuery).not.toHaveBeenCalled();
    });
  });

  describe('401 Response', () => {
    it('requires authentication before reading aggregates', async () => {
      const response = await request(server)
        .get(endpoint)
        .query(query)
        .set('x-accounting-entity-id', entityId);
      expect(response.status).toBe(401);
      expect(mockAccountActivityByTypesRepoQuery).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('enforces the existing feature gate', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(false);
      expect((await getReport()).status).toBe(403);
      expect(mockAccountActivityByTypesRepoQuery).not.toHaveBeenCalled();
    });

    it('rejects an accounting entity owned by another user', async () => {
      jest
        .mocked(accountingRepos.accountingEntity.findByIdAndUserId)
        .mockResolvedValue({ ...entity, ownerId: entityId });
      expect((await getReport()).status).toBe(403);
      expect(mockAccountActivityByTypesRepoQuery).not.toHaveBeenCalled();
    });
  });

  describe('422 Response', () => {
    it.each([
      { from: '2026-02-30' },
      { to: 'not-a-date' },
      { bucketDays: 0 },
      { bucketDays: 1.5 },
      { types: ['invalid'] },
      { types: [] },
    ])('rejects malformed dates %j', async (invalid) => {
      expect((await getReport({ ...query, ...invalid })).status).toBe(422);
      expect(mockAccountActivityByTypesRepoQuery).not.toHaveBeenCalled();
    });

    it('requires both dates', async () => {
      const response = await request(server)
        .get(endpoint)
        .set('Authorization', 'Bearer test-token')
        .set('x-accounting-entity-id', entityId);
      expect(response.status).toBe(422);
      expect(mockAccountActivityByTypesRepoQuery).not.toHaveBeenCalled();
    });
  });

  describe('500 Response', () => {
    it('sanitizes storage failures without returning partial data', async () => {
      const reporter = jest
        .spyOn(observability.reporter, 'report')
        .mockImplementation(() => {});
      mockAccountActivityByTypesRepoQuery.mockRejectedValue(
        new Error('database failure')
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
