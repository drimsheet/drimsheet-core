import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagService from '@app/context/contracts/__mocks__/feature-flag.service.mock';
import { IJournalEntryListDto } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';

import { tokenService } from '@infra/ioc/services/auth';
import * as journalEntryUseCases from '@infra/ioc/usecases/journal-entry';
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

jest.mock('../../../src/infra/ioc/usecases/journal-entry', () => ({
  __esModule: true,
  getJournalEntryUseCase: jest.fn(),
  getJournalEntriesUseCase: jest.fn(),
  createPaymentUseCase: jest.fn(),
  createReceiptUseCase: jest.fn(),
  createTransferUseCase: jest.fn(),
  rectifyJournalEntryUseCase: jest.fn(),
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

const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const accountingEntityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const entryId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
const lineId = '123e4567-e89b-12d3-a456-426614174004' as TEntityId;
const accountId = '123e4567-e89b-12d3-a456-426614174005' as TEntityId;
const counterpartyId = '123e4567-e89b-12d3-a456-426614174006' as TEntityId;
const ENDPOINT = `/api/v1/journal-entries/${entryId}`;
const now = new Date('2026-09-21T09:00:00.000Z');

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
  effectiveDate: new Date('2026-09-20T00:00:00.000Z'),
  postedAt: now,
  voidedAt: null,
  voidingEntryId: null,
  version: 1,
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
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
  ],
} satisfies IJournalEntryListDto;

describe('GET /journal-entries/{id}', () => {
  let app: Express;
  const mockGetAuthUser = tokenService.getAuthUser as jest.Mock;
  const mockFindUser = userRepos.user.findById as jest.Mock;
  const mockFindAccountingEntity = accountingRepos.accountingEntity
    .findByIdAndUserId as jest.Mock;
  const mockGetJournalEntry =
    journalEntryUseCases.getJournalEntryUseCase as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFeatureFlagService.canAccessAlpha1.mockResolvedValue(true);
    mockGetAuthUser.mockResolvedValue({ id: userId });
    mockFindUser.mockResolvedValue(user);
    mockFindAccountingEntity.mockResolvedValue(accountingEntity);
    mockGetJournalEntry.mockResolvedValue(journalEntry);
    app = createApplication();
  });

  const makeRequest = (endpoint = ENDPOINT) =>
    request(app)
      .get(endpoint)
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntityId);

  describe('200 Response', () => {
    it('exposes draft counterparty status on draft entry details', async () => {
      mockGetJournalEntry.mockResolvedValueOnce({
        ...journalEntry,
        status: 'draft',
        postedAt: null,
        lines: journalEntry.lines.map((line) => ({
          ...line,
          counterparty: line.counterparty
            ? { ...line.counterparty, status: 'draft' as const }
            : null,
        })),
      });
      const response = await makeRequest();
      expect(response.status).toBe(200);
      expect(response.body.lines[0].counterparty.status).toBe('draft');
    });

    it('returns the requested enriched journal entry', async () => {
      const response = await makeRequest();

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.body).toEqual({
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
      });
      expect(mockFindAccountingEntity).toHaveBeenCalledWith(
        accountingEntityId,
        userId,
        expect.any(Object)
      );
      expect(mockGetJournalEntry).toHaveBeenCalledWith(entryId);
    });
  });

  describe('400 Response', () => {
    it('maps an invalid journal entry id', async () => {
      mockGetJournalEntry.mockRejectedValueOnce(
        new journalEntryError.InvalidJournalEntry()
      );

      const response = await makeRequest(
        '/api/v1/journal-entries/not-a-valid-id'
      );

      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe(
        'journal_entry_error_journal_entry_invalid'
      );
      expect(mockGetJournalEntry).toHaveBeenCalledWith('not-a-valid-id');
    });
  });

  describe('401 Response', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await request(app)
        .get(ENDPOINT)
        .set('x-accounting-entity-id', accountingEntityId);

      expect(response.status).toBe(401);
      expect(mockGetJournalEntry).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('rejects a user without Alpha 1 access', async () => {
      mockFeatureFlagService.canAccessAlpha1.mockResolvedValueOnce(false);

      const response = await makeRequest();

      expect(response.status).toBe(403);
      expect(mockGetJournalEntry).not.toHaveBeenCalled();
    });

    it('rejects a foreign accounting entity context', async () => {
      mockFindAccountingEntity.mockResolvedValueOnce({
        ...accountingEntity,
        ownerId: '123e4567-e89b-12d3-a456-426614174999' as TEntityId,
      });

      const response = await makeRequest();

      expect(response.status).toBe(403);
      expect(mockGetJournalEntry).not.toHaveBeenCalled();
    });
  });

  describe('404 Response', () => {
    it('maps an absent or out-of-scope journal entry', async () => {
      mockGetJournalEntry.mockRejectedValueOnce(
        new appError.ResourceNotFound({ id: entryId })
      );

      const response = await makeRequest();

      expect(response.status).toBe(404);
      expect(response.body.errorKey).toBe('app_error_resource_not_found');
    });
  });

  describe('500 Response', () => {
    it('sanitizes unexpected failures', async () => {
      mockGetJournalEntry.mockRejectedValueOnce(new Error('database failure'));

      const response = await makeRequest();

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        name: 'InternalServerError',
        errorKey: 'app_error_unexpected',
      });
    });
  });
});
