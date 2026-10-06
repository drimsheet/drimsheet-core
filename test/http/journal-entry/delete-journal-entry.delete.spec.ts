import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagService from '@app/context/contracts/__mocks__/feature-flag.service.mock';

import { tokenService } from '@infra/ioc/services/auth';
import { deleteJournalEntryUseCase } from '@infra/ioc/usecases/journal-entry';
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
  deleteJournalEntryUseCase: jest.fn(),
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
describe('DELETE /journal-entries/{id}', () => {
  let app: Express;
  const mockGetAuthUser = tokenService.getAuthUser as jest.Mock;
  const mockFindUser = userRepos.user.findById as jest.Mock;
  const mockFindAccountingEntity = accountingRepos.accountingEntity
    .findByIdAndUserId as jest.Mock;
  const mockDeleteJournalEntryUseCase = deleteJournalEntryUseCase as jest.Mock;

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
    mockDeleteJournalEntryUseCase.mockResolvedValue(undefined);
    app = createApplication();
  });

  const makeRequest = () =>
    request(app)
      .delete(`/api/v1/journal-entries/${journalEntryId}`)
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntityId);

  describe('204 Response', () => {
    it('returns no content after successful removal', async () => {
      const response = await makeRequest();

      expect(response.status).toBe(204);
      expect(response.text).toBe('');
      expect(mockDeleteJournalEntryUseCase).toHaveBeenCalledWith(
        journalEntryId
      );
    });
  });

  describe('400 Response', () => {
    it('maps a non-deletable journal entry', async () => {
      mockDeleteJournalEntryUseCase.mockRejectedValueOnce(
        new journalEntryError.DeletionNotPermitted()
      );

      expect((await makeRequest()).status).toBe(400);
    });
  });

  describe('401 Response', () => {
    it('rejects an unauthenticated request before orchestration', async () => {
      const response = await request(app)
        .delete(`/api/v1/journal-entries/${journalEntryId}`)
        .set('x-accounting-entity-id', accountingEntityId);

      expect(response.status).toBe(401);
      expect(mockDeleteJournalEntryUseCase).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('maps creator authorization failures', async () => {
      mockDeleteJournalEntryUseCase.mockRejectedValueOnce(
        new appError.Forbidden()
      );

      expect((await makeRequest()).status).toBe(403);
    });
  });

  describe('404 Response', () => {
    it('hides unavailable journal entries', async () => {
      mockDeleteJournalEntryUseCase.mockRejectedValueOnce(
        new appError.ResourceNotFound()
      );

      expect((await makeRequest()).status).toBe(404);
    });
  });

  describe('409 Response', () => {
    it('maps a concurrent write conflict', async () => {
      mockDeleteJournalEntryUseCase.mockRejectedValueOnce(
        new appError.Conflict()
      );

      expect((await makeRequest()).status).toBe(409);
    });
  });

  describe('500 Response', () => {
    it('maps an unexpected failure', async () => {
      mockDeleteJournalEntryUseCase.mockRejectedValueOnce(
        new Error('unexpected')
      );

      expect((await makeRequest()).status).toBe(500);
    });
  });
});
