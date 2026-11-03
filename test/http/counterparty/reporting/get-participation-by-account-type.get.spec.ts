import { Server } from 'node:http';

import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';
import { ICounterparty } from '@domain/counterparty/types/counterparty.types';
import { IUser } from '@domain/user/types/user.types';

import { mockFiscalYearRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag-app.service.mock';
import { mockCounterpartyRepo } from '@app/counterparty/contracts/__mocks__/counterparty.repos.mock';

import { tokenAppService } from '@infra/ioc/services/auth';
import observability from '@infra/observability';
import accountingRepos from '@infra/persistence/repos/accounting';
import counterpartyAccountTypeParticipationRepoQuery from '@infra/persistence/repos/counterparty/queries/participation-by-account-type.reporting';
import userRepos from '@infra/persistence/repos/user';

import createApplication from '@interface/http/application';

import { closeTestServer, startTestServer } from '../../../setup/http-listener';

jest.mock(
  '@infra/persistence/repos/counterparty/queries/participation-by-account-type.reporting',
  () => ({ __esModule: true, default: jest.fn() })
);
const mockCounterpartyAccountTypeParticipationRepoQuery = jest.mocked(
  counterpartyAccountTypeParticipationRepoQuery
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
jest.mock('@infra/ioc/usecases/counterparty.reporting', () => ({
  getCounterpartyAccountTypeParticipationUseCase: jest
    .requireActual(
      '@app/counterparty/usecases/reporting/participation-by-account-type/participation-by-account-type.usecase'
    )
    .default({
      appContext: jest.requireActual('@infra/services/app-context.service')
        .default,
      counterpartyRepo: jest.requireActual(
        '@app/counterparty/contracts/__mocks__/counterparty.repos.mock'
      ).mockCounterpartyRepo,
      fiscalYearRepo: jest.requireActual(
        '@app/accounting/contracts/__mocks__/accounting.repos.mock'
      ).mockFiscalYearRepo,
      repoQuery: jest.requireMock(
        '@infra/persistence/repos/counterparty/queries/participation-by-account-type.reporting'
      ).default,
    }),
}));

const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const counterpartyId = '123e4567-e89b-12d3-a456-426614174004' as TEntityId;
const endpoint = `/api/v1/reporting/counterparties/${counterpartyId}/participation-by-account-type`;
const entity = {
  id: entityId,
  ownerId: userId,
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
} as IAccountingEntity;
const fiscalYear: IFiscalYear = {
  id: '123e4567-e89b-12d3-a456-426614174003' as TEntityId,
  createdBy: userId,
  accountingEntityId: entityId,
  name: '2025/26',
  startDate: new Date('2025-04-01'),
  endDate: new Date('2026-03-31'),
  status: 'closed',
  closedAt: new Date('2026-04-01'),
  updatedAt: new Date('2026-04-01'),
};
const validQuery = { fiscalYearId: fiscalYear.id };
const moneyDto = (amount: number) => ({
  amount,
  currencyCode: 'NGN',
  isMinorUnit: true,
});

describe('GET /reporting/counterparties/{counterpartyId}/participation-by-account-type', () => {
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
    mockCounterpartyRepo.findById.mockResolvedValue({
      id: counterpartyId,
      status: 'archived',
    } as ICounterparty);
    mockFiscalYearRepo.findById.mockResolvedValue(fiscalYear);
    mockCounterpartyAccountTypeParticipationRepoQuery.mockResolvedValue([]);
    server = await startTestServer(createApplication());
  });
  afterEach(async () => {
    await closeTestServer(server);
  });
  const getReport = (
    query: Record<string, string | undefined> = validQuery,
    path = endpoint
  ) =>
    request(server)
      .get(path)
      .query(query)
      .set('Authorization', 'Bearer test-token')
      .set('x-accounting-entity-id', entityId);

  describe('200 Response', () => {
    it('returns only revenue and expense net amounts in functional minor units', async () => {
      mockCounterpartyAccountTypeParticipationRepoQuery.mockResolvedValue([
        { type: 'revenue', debits: 100n, credits: 900n },
        { type: 'expense', debits: 100n, credits: 500n },
      ]);
      const response = await getReport();
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/json/);
      expect(response.body).toEqual({
        counterpartyId,
        fiscalYearId: fiscalYear.id,
        period: { from: '2025-04-01', to: '2026-03-31' },
        revenue: moneyDto(800),
        expense: moneyDto(-400),
      });
      expect(
        mockCounterpartyAccountTypeParticipationRepoQuery
      ).toHaveBeenCalledWith(
        {
          accountingEntityId: entityId,
          counterpartyId,
          currencyCode: 'NGN',
          period: { from: fiscalYear.startDate, to: fiscalYear.endDate },
        },
        expect.any(Object)
      );
    });
    it('returns zero for every class without activity', async () => {
      const response = await getReport();
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        revenue: moneyDto(0),
        expense: moneyDto(0),
      });
    });
  });
  describe('400 Response', () => {
    it('rejects an invalid counterparty ID before reading storage', async () => {
      const response = await getReport(
        validQuery,
        endpoint.replace(counterpartyId, 'bad-id')
      );
      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe(
        'counterparty_error_counterparty_id_invalid'
      );
      expect(mockCounterpartyRepo.findById).not.toHaveBeenCalled();
    });
    it('rejects totals beyond the report limit', async () => {
      mockCounterpartyAccountTypeParticipationRepoQuery.mockResolvedValue([
        { type: 'revenue', debits: 0n, credits: 100000000000001n },
      ]);
      const response = await getReport();
      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe(
        'app_error_reporting_amount_limit_invalid'
      );
    });
  });
  describe('401 Response', () => {
    it('requires authentication', async () => {
      expect(
        (
          await request(server)
            .get(endpoint)
            .query(validQuery)
            .set('x-accounting-entity-id', entityId)
        ).status
      ).toBe(401);
      expect(mockCounterpartyRepo.findById).not.toHaveBeenCalled();
    });
  });
  describe('403 Response', () => {
    it('requires feature access', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(false);
      expect((await getReport()).status).toBe(403);
      expect(mockCounterpartyRepo.findById).not.toHaveBeenCalled();
    });
    it('requires entity ownership', async () => {
      jest
        .mocked(accountingRepos.accountingEntity.findByIdAndUserId)
        .mockResolvedValue({ ...entity, ownerId: entityId });
      expect((await getReport()).status).toBe(403);
      expect(mockCounterpartyRepo.findById).not.toHaveBeenCalled();
    });
  });
  describe('404 Response', () => {
    it('rejects a missing or foreign counterparty', async () => {
      mockCounterpartyRepo.findById.mockResolvedValue(null);
      const response = await getReport();
      expect(response.status).toBe(404);
      expect(response.body.errorKey).toBe(
        'app_error_counterparty_reporting_counterparty_not_found'
      );
      expect(
        mockCounterpartyAccountTypeParticipationRepoQuery
      ).not.toHaveBeenCalled();
    });
    it('rejects a missing or foreign fiscal year', async () => {
      mockFiscalYearRepo.findById.mockResolvedValue(null);
      expect((await getReport()).status).toBe(404);
      expect(
        mockCounterpartyAccountTypeParticipationRepoQuery
      ).not.toHaveBeenCalled();
    });
  });
  describe('422 Response', () => {
    it.each([undefined, 'bad-id'])(
      'requires a valid fiscal-year ID: %s',
      async (fiscalYearId) => {
        const response = await getReport({ fiscalYearId });
        expect(response.status).toBe(422);
        expect(response.body.errorKey).toBe('app_error_validation_error');
        expect(mockCounterpartyRepo.findById).not.toHaveBeenCalled();
      }
    );
  });
  describe('500 Response', () => {
    it('sanitizes storage errors', async () => {
      const reporter = jest
        .spyOn(observability.reporter, 'report')
        .mockImplementation(() => {});
      mockCounterpartyAccountTypeParticipationRepoQuery.mockRejectedValue(
        new Error('private storage failure')
      );
      try {
        const response = await getReport();
        expect(response.status).toBe(500);
        expect(response.body.errorKey).toBe('app_error_unexpected');
        expect(JSON.stringify(response.body)).not.toContain(
          'private storage failure'
        );
      } finally {
        reporter.mockRestore();
      }
    });
  });
});
