import { Server } from 'node:http';

import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';
import { IPaginatedResponse } from '@shared/values/pagination/types/pagination.types';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { IUser } from '@domain/user/types/user.types';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag-app.service.mock';
import mockJournalEntryQueryRepo from '@app/journal-entry/contracts/__mocks__/journal-entry.query.repo.mock';
import { IJournalEntryListDto } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import makeGetJournalEntriesUsecase from '@app/journal-entry/usecases/get-journal-entries.usecase';

import { tokenAppService } from '@infra/ioc/services/auth';
import * as journalEntryUseCases from '@infra/ioc/usecases/journal-entry';
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
  featureFlagAppService: jest.requireActual<
    typeof import('@app/context/contracts/__mocks__/feature-flag-app.service.mock')
  >('@app/context/contracts/__mocks__/feature-flag-app.service.mock').default,
}));

jest.mock('../../../src/infra/ioc/services/auth', () => ({
  __esModule: true,
  tokenAppService: { getAuthUser: jest.fn() },
}));

jest.mock('../../../src/infra/ioc/usecases/journal-entry', () => ({
  __esModule: true,
  getJournalEntriesUseCase: jest.fn(),
  createPaymentUseCase: jest.fn(),
  createReceiptUseCase: jest.fn(),
  createTransferUseCase: jest.fn(),
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

const ENDPOINT = '/api/v1/journal-entries';
const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const accountingEntityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const accountId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
const entryId = '123e4567-e89b-12d3-a456-426614174004' as TEntityId;
const lineId = '123e4567-e89b-12d3-a456-426614174005' as TEntityId;
const counterpartyId = '123e4567-e89b-12d3-a456-426614174006' as TEntityId;
const now = new Date('2026-09-16T09:00:00.000Z');

const user = {
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  id: userId,
  version: 1,
  email: 'journal@example.com',
  emailVerified: true,
  firstName: 'Journal',
  lastName: 'Owner',
  deletedAt: null,
  createdAt: now,
  updatedAt: now,
} satisfies IUser;

const accountingEntity = {
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  id: accountingEntityId,
  ownerId: userId,
  name: 'Journal Business',
  type: 'individual',
  status: 'active',
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
  createdAt: now,
  updatedAt: now,
} satisfies IAccountingEntity;

const journalEntry = {
  id: entryId,
  accountingEntityId,
  sourceType: 'receipt',
  memo: 'Customer receipt',
  status: 'posted',
  effectiveDate: new Date('2026-09-15T00:00:00.000Z'),
  postedAt: now,
  voidedAt: null,
  voidingEntryId: null,
  createdBy: userId,
  createdAt: now,
  updatedAt: now,
  attachments: [],
  lines: [
    {
      id: lineId,
      entryId,
      account: { id: accountId, name: 'Cash' },
      counterparty: {
        status: 'active' as const,
        id: counterpartyId,
        name: 'Acme Ltd',
      },
      sequenceOrder: 1,
      amount: { amount: 50_00, currencyCode: 'NGN', isMinorUnit: true },
      exchangeRate: null,
      functionalAmount: {
        amount: 50_00,
        currencyCode: 'NGN',
        isMinorUnit: true,
      },
      side: 'debit',
      description: 'Cash received',
      createdAt: now,
      updatedAt: now,
    },
  ],
} satisfies IJournalEntryListDto;

const paginatedEntries = {
  data: [journalEntry],
  meta: { page: 2, limit: 5, total: 1, totalPages: 1 },
} satisfies IPaginatedResponse<IJournalEntryListDto>;

describe('GET /journal-entries', () => {
  let app: Express;
  let server: Server;
  const mockGetAuthUser = tokenAppService.getAuthUser as jest.Mock;
  const mockFindUser = userRepos.user.findById as jest.Mock;
  const mockFindAccountingEntity = accountingRepos.accountingEntity
    .findByIdAndUserId as jest.Mock;
  const mockGetJournalEntries =
    journalEntryUseCases.getJournalEntriesUseCase as jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(true);
    mockGetAuthUser.mockResolvedValue({ id: userId });
    mockFindUser.mockResolvedValue(user);
    mockFindAccountingEntity.mockResolvedValue(accountingEntity);
    mockGetJournalEntries.mockResolvedValue(paginatedEntries);
    app = createApplication();
    server = await startTestServer(app);
  });

  afterEach(async () => {
    await closeTestServer(server);
  });

  const makeRequest = (query: object | string = {}) =>
    request(server)
      .get(ENDPOINT)
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntityId)
      .query(query);

  describe('200 Response', () => {
    it.each([
      ['createdAt', '2026-09-01T12:30:00.123+01:00'],
      ['effectiveDate', '2026-09-01'],
      ['updatedAt', '2026-09-01T12:30:00Z'],
    ])('parses flat open-ended %s filters', async (field, value) => {
      for (const side of ['From', 'To']) {
        const response = await makeRequest(
          `${field}${side}=${encodeURIComponent(value)}`
        );
        expect(response.status).toBe(200);
        expect(mockGetJournalEntries).toHaveBeenLastCalledWith(
          expect.objectContaining({
            [`${field}${side}`]: value,
          })
        );
      }
    });

    it('returns journal entries and forwards coerced query values', async () => {
      const response = await makeRequest({
        accountId,
        counterpartyId,
        page: 2,
        limit: 5,
        orderBy: 'effectiveDate',
        status: 'archived',
        sourceType: 'receipt',
        sortDirection: 'asc',
        search: 'receipt',
        createdAtFrom: '2026-09-01T00:00:00Z',
        createdAtTo: '2026-10-01T00:00:00Z',
        effectiveDateFrom: '2026-09-01',
        effectiveDateTo: '2026-09-30',
        updatedAtFrom: '2026-09-01T00:00:00+01:00',
        updatedAtTo: '2026-10-01T00:00:00+01:00',
        currencyCode: 'NGN',
        accountType: 'asset',
      });

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.body).toEqual({
        data: [
          {
            ...journalEntry,
            effectiveDate: journalEntry.effectiveDate.toISOString(),
            postedAt: journalEntry.postedAt.toISOString(),
            createdAt: journalEntry.createdAt.toISOString(),
            updatedAt: journalEntry.updatedAt.toISOString(),
            lines: journalEntry.lines.map((line) => ({
              ...line,
              createdAt: line.createdAt.toISOString(),
              updatedAt: line.updatedAt.toISOString(),
            })),
          },
        ],
        meta: paginatedEntries.meta,
      });
      expect(mockFindAccountingEntity).toHaveBeenCalledWith(
        accountingEntityId,
        userId,
        expect.any(Object)
      );
      expect(mockGetJournalEntries).toHaveBeenCalledWith({
        accountId,
        counterpartyId,
        page: 2,
        limit: 5,
        orderBy: 'effectiveDate',
        status: 'archived',
        sourceType: 'receipt',
        sortDirection: 'asc',
        search: 'receipt',
        createdAtFrom: '2026-09-01T00:00:00Z',
        createdAtTo: '2026-10-01T00:00:00Z',
        effectiveDateFrom: '2026-09-01',
        effectiveDateTo: '2026-09-30',
        updatedAtFrom: '2026-09-01T00:00:00+01:00',
        updatedAtTo: '2026-10-01T00:00:00+01:00',
        currencyCode: 'NGN',
        accountType: 'asset',
      });
    });
  });

  describe('401 Response', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await request(server)
        .get(ENDPOINT)
        .set('x-accounting-entity-id', accountingEntityId);

      expect(response.status).toBe(401);
      expect(mockGetJournalEntries).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('rejects a user without Alpha 1 access', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValueOnce(false);

      const response = await makeRequest();

      expect(response.status).toBe(403);
      expect(mockGetJournalEntries).not.toHaveBeenCalled();
    });
  });

  describe('422 Response', () => {
    it.each(['reversal', 'invalid-source'])(
      'rejects unsupported source type %s',
      async (sourceType) => {
        const response = await makeRequest({ sourceType });
        expect(response.status).toBe(422);
        expect(mockGetJournalEntries).not.toHaveBeenCalled();
      }
    );

    it.each([
      'effectiveDateRange[from]=2026-09-01',
      'effectiveDateRange=2026-09-01',
      'effectiveDateRange[from][nested]=2026-09-01',
      'effectiveDateRange[until]=2026-09-01',
      'effectiveDateFrom=2026-09-01&effectiveDateFrom=2026-09-02',
    ])('rejects unsupported or malformed range syntax: %s', async (query) => {
      const response = await makeRequest(query);
      expect(response.status).toBe(422);
      expect(mockGetJournalEntries).not.toHaveBeenCalled();
    });

    it.each([
      ['effectiveDateFrom=2026-02-30', 'effectiveDateFrom'],
      ['effectiveDateFrom=', 'effectiveDateFrom'],
      [
        'effectiveDateFrom=2026-09-30&effectiveDateTo=2026-09-01',
        'effectiveDateTo',
      ],
      ['createdAtFrom=2026-09-01T00:00:00.000999Z', 'createdAtFrom'],
      ['updatedAtTo=2026-09-01T00:00:00.1234Z', 'updatedAtTo'],
    ])('returns flat validation errors for %s', async (query, field) => {
      mockGetJournalEntries.mockImplementationOnce(
        makeGetJournalEntriesUsecase({
          appContext: mockAppContext,
          journalEntryQueryRepo: mockJournalEntryQueryRepo,
        })
      );
      const response = await makeRequest(query);
      expect(response.status).toBe(422);
      expect(response.body.validationErrors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field })])
      );
      expect(mockAppContext.get).not.toHaveBeenCalled();
      expect(mockJournalEntryQueryRepo.findAll).not.toHaveBeenCalled();
    });

    it('rejects unsupported journal entry statuses', async () => {
      const response = await makeRequest({ status: 'voided' });

      expect(response.status).toBe(422);
      expect(mockGetJournalEntries).not.toHaveBeenCalled();
    });

    it('rejects invalid query formats before orchestration', async () => {
      const response = await makeRequest({ limit: 'not-a-number' });

      expect(response.status).toBe(422);
      expect(response.body.errorKey).toBe('app_error_validation_error');
      expect(mockGetJournalEntries).not.toHaveBeenCalled();
    });

    it('maps use-case validation failures', async () => {
      const validationErrors = [
        {
          field: 'counterpartyId',
          message: 'journal_line_error_counterparty_id_invalid',
        },
      ];
      mockGetJournalEntries.mockRejectedValueOnce(
        new appError.UnprocessableEntity(validationErrors)
      );

      const response = await makeRequest({
        counterpartyId: 'invalid-counterparty-id',
      });

      expect(response.status).toBe(422);
      expect(response.body.validationErrors).toEqual(validationErrors);
    });
  });

  describe('500 Response', () => {
    it('sanitizes unexpected failures', async () => {
      mockGetJournalEntries.mockRejectedValueOnce(
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
