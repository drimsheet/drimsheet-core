import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag.service.mock';
import { IJournalEntryRectificationDto } from '@app/journal-entry/dtos/journal-entry-rectification/journal-entry-rectification.dto';

import { tokenAppService } from '@infra/ioc/services/auth';
import { rectifyJournalEntryUseCase } from '@infra/ioc/usecases/journal-entry';
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
  tokenAppService: { getAuthUser: jest.fn() },
}));

jest.mock('../../../src/infra/ioc/usecases/journal-entry', () => ({
  __esModule: true,
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

const journalEntryId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const accountingEntityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const sourceLineId = '123e4567-e89b-12d3-a456-426614174004' as TEntityId;
const destinationLineId = '123e4567-e89b-12d3-a456-426614174007' as TEntityId;
const sourceAccountId = '123e4567-e89b-12d3-a456-426614174005' as TEntityId;
const destinationAccountId =
  '123e4567-e89b-12d3-a456-426614174008' as TEntityId;
const effectiveDate = new Date('2026-09-01T00:00:00.000Z');

const validPayload = {
  sourceType: 'transfer',
  attachments: [],
  sourceLine: {
    id: sourceLineId,
    accountId: sourceAccountId,
    amount: { amount: 150, currencyCode: 'NGN', isMinorUnit: false },
    exchangeRate: null,
    description: 'Corrected transfer',
    sequenceOrder: 1,
  },
  destinationLine: {
    id: destinationLineId,
    accountId: destinationAccountId,
    amount: { amount: 150, currencyCode: 'NGN', isMinorUnit: false },
    exchangeRate: null,
    description: null,
    sequenceOrder: 2,
  },
  chargeLines: [],
  effectiveDate,
  postedAt: effectiveDate,
  memo: 'Corrected transfer',
} as const;

const rectification: IJournalEntryRectificationDto = {
  mode: 'void_and_replace',
  originalJournalEntryId: journalEntryId,
  currentJournalEntryId: '123e4567-e89b-12d3-a456-426614174010',
  reversingJournalEntryId: '123e4567-e89b-12d3-a456-426614174011',
  journalEntry: {
    id: '123e4567-e89b-12d3-a456-426614174010',
    accountingEntityId,
    sourceType: 'transfer',
    memo: 'Corrected transfer',
    status: 'posted',
    effectiveDate,
    postedAt: effectiveDate,
    voidedAt: null,
    voidingEntryId: null,
    createdBy: userId,
    createdAt: effectiveDate,
    updatedAt: effectiveDate,
    attachments: [],
    lines: [],
  },
};

describe('POST /journal-entries/{id}/rectify', () => {
  let app: Express;
  const mockGetAuthUser = tokenAppService.getAuthUser as jest.Mock;
  const mockFindUser = userRepos.user.findById as jest.Mock;
  const mockFindAccountingEntity = accountingRepos.accountingEntity
    .findByIdAndUserId as jest.Mock;
  const mockRectifyJournalEntryUseCase =
    rectifyJournalEntryUseCase as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(true);
    mockGetAuthUser.mockResolvedValue({ id: userId });
    mockFindUser.mockResolvedValue({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: userId,
    } as IUser);
    mockFindAccountingEntity.mockResolvedValue({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: accountingEntityId,
      ownerId: userId,
      functionalCurrencyCode: 'NGN',
      jurisdictionCode: 'NG',
    } as IAccountingEntity);
    mockRectifyJournalEntryUseCase.mockResolvedValue(rectification);
    app = createApplication();
  });

  const makeRequest = (payload: object = validPayload) =>
    request(app)
      .post(`/api/v1/journal-entries/${journalEntryId}/rectify`)
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntityId)
      .send(payload);

  it('returns the corrected journal entry and rectification lineage', async () => {
    const response = await makeRequest();

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      mode: 'void_and_replace',
      originalJournalEntryId: journalEntryId,
      currentJournalEntryId: rectification.currentJournalEntryId,
      reversingJournalEntryId: rectification.reversingJournalEntryId,
    });
    expect(mockRectifyJournalEntryUseCase).toHaveBeenCalledWith(
      journalEntryId,
      expect.objectContaining({
        sourceType: 'transfer',
        effectiveDate: expect.any(Date),
        postedAt: expect.any(Date),
      })
    );
  });

  describe('400 Response', () => {
    it('returns the draft-account posting error with the blocking accounts', async () => {
      const cause = {
        accounts: [
          {
            id: 'a1111111-1111-4111-8111-111111111111',
            name: 'Draft ledger account',
          },
        ],
      };
      mockRectifyJournalEntryUseCase.mockRejectedValueOnce(
        new journalEntryError.DraftLedgerAccountNotAllowed(cause)
      );
      const response = await makeRequest();
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        errorKey:
          'journal_entry_error_draft_ledger_account_not_allowed_invalid',
        cause,
      });
    });

    it('returns the draft-counterparty posting error during rectification', async () => {
      mockRectifyJournalEntryUseCase.mockRejectedValueOnce(
        new journalEntryError.DraftCounterpartyNotAllowed()
      );
      const response = await makeRequest();
      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe(
        'journal_entry_error_draft_counterparty_not_allowed_invalid'
      );
    });
  });

  it('maps a stale version conflict to 409', async () => {
    mockRectifyJournalEntryUseCase.mockRejectedValueOnce(
      new appError.Conflict()
    );

    const response = await makeRequest();

    expect(response.status).toBe(409);
  });

  it('rejects unauthenticated requests', async () => {
    const response = await request(app)
      .post(`/api/v1/journal-entries/${journalEntryId}/rectify`)
      .set('x-accounting-entity-id', accountingEntityId)
      .send(validPayload);

    expect(response.status).toBe(401);
    expect(mockRectifyJournalEntryUseCase).not.toHaveBeenCalled();
  });

  it('rejects an invalid journal entry id', async () => {
    mockRectifyJournalEntryUseCase.mockRejectedValueOnce(
      new journalEntryError.InvalidJournalEntry()
    );
    const response = await request(app)
      .post('/api/v1/journal-entries/not-a-uuid/rectify')
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntityId)
      .send(validPayload);

    expect(response.status).toBe(400);
    expect(mockRectifyJournalEntryUseCase).toHaveBeenCalledWith(
      'not-a-uuid',
      expect.any(Object)
    );
  });
});
