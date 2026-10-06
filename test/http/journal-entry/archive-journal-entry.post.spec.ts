import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagService from '@app/context/contracts/__mocks__/feature-flag.service.mock';
import { IJournalEntryDto } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';

import { tokenService } from '@infra/ioc/services/auth';
import { archiveJournalEntryUseCase } from '@infra/ioc/usecases/journal-entry';
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
  archiveJournalEntryUseCase: jest.fn(),
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
const journalEntryId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
const now = new Date('2026-09-22T10:00:00.000Z');
const archivedEntry = {
  id: journalEntryId,
  accountingEntityId,
  sourceType: 'transfer',
  memo: 'Archived transfer',
  status: 'archived',
  effectiveDate: now,
  postedAt: now,
  voidedAt: null,
  voidingEntryId: null,
  createdBy: userId,
  createdAt: now,
  updatedAt: now,
  attachments: [],
  lines: [],
} satisfies IJournalEntryDto;

describe('POST /journal-entries/{id}/archive', () => {
  let app: Express;
  const mockGetAuthUser = tokenService.getAuthUser as jest.Mock;
  const mockFindUser = userRepos.user.findById as jest.Mock;
  const mockFindAccountingEntity = accountingRepos.accountingEntity
    .findByIdAndUserId as jest.Mock;
  const mockArchiveJournalEntryUseCase =
    archiveJournalEntryUseCase as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFeatureFlagService.canAccessAlpha1.mockResolvedValue(true);
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
    mockArchiveJournalEntryUseCase.mockResolvedValue(archivedEntry);
    app = createApplication();
  });

  const makeRequest = () =>
    request(app)
      .post(`/api/v1/journal-entries/${journalEntryId}/archive`)
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntityId);

  describe('200 Response', () => {
    it('returns the archived journal entry', async () => {
      const response = await makeRequest();

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: journalEntryId,
        status: 'archived',
      });
      expect(response.body).not.toHaveProperty('version');
      expect(mockArchiveJournalEntryUseCase).toHaveBeenCalledWith(
        journalEntryId
      );
    });
  });

  describe('401 Response', () => {
    it('rejects an unauthenticated request before orchestration', async () => {
      const response = await request(app)
        .post(`/api/v1/journal-entries/${journalEntryId}/archive`)
        .set('x-accounting-entity-id', accountingEntityId);

      expect(response.status).toBe(401);
      expect(mockArchiveJournalEntryUseCase).not.toHaveBeenCalled();
    });
  });

  describe('409 Response', () => {
    it('maps a concurrent write conflict', async () => {
      mockArchiveJournalEntryUseCase.mockRejectedValueOnce(
        new appError.Conflict()
      );

      expect((await makeRequest()).status).toBe(409);
    });
  });

  describe('400 Response', () => {
    it('maps an invalid status transition', async () => {
      mockArchiveJournalEntryUseCase.mockRejectedValueOnce(
        new journalEntryError.InvalidStatusTransition()
      );

      expect((await makeRequest()).status).toBe(400);
    });
  });
});
