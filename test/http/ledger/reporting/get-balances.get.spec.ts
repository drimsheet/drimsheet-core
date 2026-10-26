import { Server } from 'node:http';

import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag-app.service.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';

import { tokenAppService } from '@infra/ioc/services/auth';
import accountingRepos from '@infra/persistence/repos/accounting';
import balanceSeriesRepoQuery from '@infra/persistence/repos/ledger/queries/balance-series.reporting';
import userRepos from '@infra/persistence/repos/user';

import createApplication from '@interface/http/application';

import { closeTestServer, startTestServer } from '../../../setup/http-listener';

jest.mock(
  '@infra/persistence/repos/ledger/queries/balance-series.reporting',
  () => ({ __esModule: true, default: jest.fn() })
);
const mockBalanceSeriesRepoQuery = jest.mocked(balanceSeriesRepoQuery);

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
jest.mock('@infra/ioc/usecases/ledger.reporting', () => ({
  getBalancesByTypeUseCase: jest
    .requireActual(
      '@app/ledger/usecases/reporting/balances-by-type/balances-by-type.usecase'
    )
    .default({
      appContext: jest.requireActual('@infra/services/app-context.service')
        .default,
      repoQuery: jest.requireMock(
        '@infra/persistence/repos/ledger/queries/balance-series.reporting'
      ).default,
      ledgerAccountRepo: jest.requireActual(
        '@app/ledger/contracts/__mocks__/ledger.repos.mock'
      ).mockLedgerAccountRepo,
    }),
  getBalancesBySubTypeUseCase: jest
    .requireActual(
      '@app/ledger/usecases/reporting/balances-by-sub-type/balances-by-sub-type.usecase'
    )
    .default({
      appContext: jest.requireActual('@infra/services/app-context.service')
        .default,
      repoQuery: jest.requireMock(
        '@infra/persistence/repos/ledger/queries/balance-series.reporting'
      ).default,
      ledgerAccountRepo: jest.requireActual(
        '@app/ledger/contracts/__mocks__/ledger.repos.mock'
      ).mockLedgerAccountRepo,
    }),
  getBalancesByBehaviorUseCase: jest
    .requireActual(
      '@app/ledger/usecases/reporting/balances-by-behavior/balances-by-behavior.usecase'
    )
    .default({
      appContext: jest.requireActual('@infra/services/app-context.service')
        .default,
      repoQuery: jest.requireMock(
        '@infra/persistence/repos/ledger/queries/balance-series.reporting'
      ).default,
      ledgerAccountRepo: jest.requireActual(
        '@app/ledger/contracts/__mocks__/ledger.repos.mock'
      ).mockLedgerAccountRepo,
    }),
  getBalancesByAccountUseCase: jest
    .requireActual(
      '@app/ledger/usecases/reporting/balances-by-account/balances-by-account.usecase'
    )
    .default({
      appContext: jest.requireActual('@infra/services/app-context.service')
        .default,
      repoQuery: jest.requireMock(
        '@infra/persistence/repos/ledger/queries/balance-series.reporting'
      ).default,
      ledgerAccountRepo: jest.requireActual(
        '@app/ledger/contracts/__mocks__/ledger.repos.mock'
      ).mockLedgerAccountRepo,
    }),
}));

const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const accountId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
const period = { from: '2026-01-01', to: '2026-01-10', bucketDays: 4 };
const entity = {
  id: entityId,
  ownerId: userId,
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
} as IAccountingEntity;
const account = {
  id: accountId,
  accountingEntityId: entityId,
  isControlAccount: false,
  deletedAt: null,
} as ILedgerAccount;
const endpoints = [
  {
    path: 'balances-by-type',
    filter: { types: ['asset'] },
    identity: { type: 'asset' },
  },
  {
    path: 'balances-by-sub-type',
    filter: { subTypes: ['cash_and_cash_equivalent'] },
    identity: { type: 'asset', subType: 'cash_and_cash_equivalent' },
  },
  {
    path: 'balances-by-behavior',
    filter: { behaviors: ['bank'] },
    identity: {
      type: 'asset',
      subType: 'cash_and_cash_equivalent',
      behavior: 'bank',
    },
  },
  {
    path: 'balances-by-account',
    filter: { accountIds: [accountId] },
    identity: { accountId },
  },
];

for (const endpoint of endpoints) {
  describe(`GET /reporting/ledger/${endpoint.path}`, () => {
    let app: Express;
    let server: Server;
    beforeEach(async () => {
      jest.resetAllMocks();
      jest
        .mocked(tokenAppService.getAuthUser)
        .mockResolvedValue({ id: userId });
      jest
        .mocked(userRepos.user.findById)
        .mockResolvedValue({ id: userId, actorId: userId } as IUser);
      jest
        .mocked(accountingRepos.accountingEntity.findByIdAndUserId)
        .mockResolvedValue(entity);
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(true);
      mockLedgerAccountRepo.findById.mockResolvedValue(account);
      mockBalanceSeriesRepoQuery.mockResolvedValue([
        {
          accountId,
          type: 'asset',
          subType: 'cash_and_cash_equivalent',
          behavior: 'bank',
          normalBalance: 'debit',
          bucketIndex: -1,
          debits: 1000n,
          credits: 100n,
        },
      ]);
      app = createApplication();
      server = await startTestServer(app);
    });
    afterEach(async () => {
      await closeTestServer(server);
    });
    const getReport = (changes: Record<string, unknown> = {}) =>
      request(server)
        .get(`/api/v1/reporting/ledger/${endpoint.path}`)
        .query({ ...period, ...endpoint.filter, ...changes })
        .set('Authorization', 'Bearer test-token')
        .set('x-accounting-entity-id', entityId);

    describe('200 Response', () => {
      it.each(['[]', '[0]'])(
        'accepts array query keys ending in %s',
        async (suffix) => {
          const query = new URLSearchParams({
            from: period.from,
            to: period.to,
            bucketDays: String(period.bucketDays),
          });
          for (const filterEntry of Object.entries(endpoint.filter)) {
            const [key, values] = filterEntry;
            query.append(`${key}${suffix}`, values[0]);
          }

          const response = await request(server)
            .get(`/api/v1/reporting/ledger/${endpoint.path}`)
            .query(query.toString())
            .set('Authorization', 'Bearer test-token')
            .set('x-accounting-entity-id', entityId);

          expect(response.status).toBe(200);
          expect(response.body.buckets[0].balances[0]).toEqual({
            ...endpoint.identity,
            closingBalance: {
              amount: 900,
              currencyCode: 'NGN',
              isMinorUnit: true,
            },
          });
          expect(mockBalanceSeriesRepoQuery).toHaveBeenCalledWith(
            expect.objectContaining({ filter: endpoint.filter }),
            expect.any(Object)
          );
        }
      );

      if (endpoint.path === 'balances-by-account') {
        it('accepts a control account and returns its subtree balance', async () => {
          mockLedgerAccountRepo.findById.mockResolvedValue({
            ...account,
            isControlAccount: true,
          });
          const response = await getReport();
          expect(response.status).toBe(200);
          expect(response.body.buckets[0].balances).toEqual([
            {
              accountId,
              closingBalance: {
                amount: 900,
                currencyCode: 'NGN',
                isMinorUnit: true,
              },
            },
          ]);
        });
      }

      if (endpoint.path !== 'balances-by-account') {
        it('returns no series when the chart has no matching hierarchy roots', async () => {
          mockBalanceSeriesRepoQuery.mockResolvedValue([]);
          const response = await getReport();
          expect(response.status).toBe(200);
          expect(response.body.buckets).toEqual(
            ['2026-01-04', '2026-01-08', '2026-01-10'].map((date) => ({
              date,
              balances: [],
            }))
          );
        });
      }

      it('returns the concrete date-grouped contract with functional money', async () => {
        const response = await getReport();
        expect(response.status).toBe(200);
        expect(response.type).toBe('application/json');
        expect(response.body.period).toEqual({
          from: period.from,
          to: period.to,
        });
        expect(response.body.buckets).toEqual(
          ['2026-01-04', '2026-01-08', '2026-01-10'].map((date) => ({
            date,
            balances: [
              {
                ...endpoint.identity,
                closingBalance: {
                  amount: 900,
                  currencyCode: 'NGN',
                  isMinorUnit: true,
                },
              },
            ],
          }))
        );
        expect(mockBalanceSeriesRepoQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            accountingEntityId: entityId,
            filter: endpoint.filter,
          }),
          expect.any(Object)
        );
      });
    });
    describe('400 Response', () => {
      it('rejects an excessive period before the read', async () => {
        expect(
          (await getReport({ from: '2024-01-01', to: '2025-01-01' })).status
        ).toBe(400);
        expect(mockBalanceSeriesRepoQuery).not.toHaveBeenCalled();
      });
    });
    describe('401 Response', () => {
      it('requires authentication', async () => {
        const response = await request(server)
          .get(`/api/v1/reporting/ledger/${endpoint.path}`)
          .query({ ...period, ...endpoint.filter })
          .set('x-accounting-entity-id', entityId);
        expect(response.status).toBe(401);
        expect(mockBalanceSeriesRepoQuery).not.toHaveBeenCalled();
      });
    });
    describe('403 Response', () => {
      it('enforces the feature gate before the read', async () => {
        mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(false);
        expect((await getReport()).status).toBe(403);
        expect(mockBalanceSeriesRepoQuery).not.toHaveBeenCalled();
      });
      it('enforces accounting entity access', async () => {
        jest
          .mocked(accountingRepos.accountingEntity.findByIdAndUserId)
          .mockResolvedValue({ ...entity, ownerId: accountId });
        expect((await getReport()).status).toBe(403);
        expect(mockBalanceSeriesRepoQuery).not.toHaveBeenCalled();
      });
    });
    describe('422 Response', () => {
      it.each([{ bucketDays: 0 }, { from: '2026-02-30' }])(
        'rejects invalid query input %j',
        async (invalid) => {
          expect((await getReport(invalid)).status).toBe(422);
          expect(mockBalanceSeriesRepoQuery).not.toHaveBeenCalled();
        }
      );
      it('requires the endpoint-specific filter', async () => {
        const response = await request(server)
          .get(`/api/v1/reporting/ledger/${endpoint.path}`)
          .query(period)
          .set('Authorization', 'Bearer test-token')
          .set('x-accounting-entity-id', entityId);
        expect(response.status).toBe(422);
        expect(mockBalanceSeriesRepoQuery).not.toHaveBeenCalled();
      });
    });
    if (endpoint.path === 'balances-by-account') {
      describe('404 Response', () => {
        it('does not expose foreign or absent accounts', async () => {
          mockLedgerAccountRepo.findById.mockResolvedValue(null);
          expect((await getReport()).status).toBe(404);
          expect(mockBalanceSeriesRepoQuery).not.toHaveBeenCalled();
        });
      });
    }
  });
}
