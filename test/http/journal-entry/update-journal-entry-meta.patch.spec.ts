import { Server } from 'node:http';

import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag-app.service.mock';
import { IJournalEntryDto } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';

import { tokenAppService } from '@infra/ioc/services/auth';
import { updateJournalEntryMetaUseCase } from '@infra/ioc/usecases/journal-entry';
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

jest.mock('@infra/ioc/services/auth', () => ({
  __esModule: true,
  tokenAppService: { getAuthUser: jest.fn() },
}));

jest.mock('@infra/ioc/usecases/journal-entry', () => ({
  __esModule: true,
  updateJournalEntryMetaUseCase: jest.fn(),
}));

jest.mock('@infra/persistence/repos/accounting', () => ({
  __esModule: true,
  default: {
    accountingEntity: { findByIdAndUserId: jest.fn() },
  },
}));

jest.mock('@infra/persistence/repos/user', () => ({
  __esModule: true,
  default: {
    user: { findById: jest.fn() },
  },
}));

const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const accountingEntityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
const journalEntryId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
const now = new Date('2026-09-22T10:00:00.000Z');
const updatedEntry = {
  id: journalEntryId,
  accountingEntityId,
  sourceType: 'transfer',
  memo: 'Updated transfer',
  status: 'posted',
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

describe('PATCH /journal-entries/{id}/meta', () => {
  let app: Express;
  let server: Server;
  const mockGetAuthUser = tokenAppService.getAuthUser as jest.Mock;
  const mockFindUser = userRepos.user.findById as jest.Mock;
  const mockFindAccountingEntity = accountingRepos.accountingEntity
    .findByIdAndUserId as jest.Mock;
  const mockUpdateJournalEntryMetaUseCase =
    updateJournalEntryMetaUseCase as jest.Mock;

  beforeEach(async () => {
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
    mockUpdateJournalEntryMetaUseCase.mockResolvedValue(updatedEntry);
    app = createApplication();
    server = await startTestServer(app);
  });

  afterEach(async () => {
    await closeTestServer(server);
  });

  const makeRequest = () =>
    request(server)
      .patch(`/api/v1/journal-entries/${journalEntryId}/meta`)
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntityId)
      .send({ header: { memo: null } });

  describe('200 Response', () => {
    it('returns the updated journal entry', async () => {
      const response = await makeRequest();

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: journalEntryId,
        status: 'posted',
      });
      expect(response.body).not.toHaveProperty('version');
      expect(mockUpdateJournalEntryMetaUseCase).toHaveBeenCalledWith(
        journalEntryId,
        { header: { memo: null } }
      );
    });

    it('passes the attachment patch through', async () => {
      const payload = {
        attachments: {
          add: [journalEntryId],
          remove: ['https://files.example.com/receipt.pdf'],
        },
      };
      const response = await request(server)
        .patch(`/api/v1/journal-entries/${journalEntryId}/meta`)
        .set('Authorization', 'Bearer valid-token')
        .set('x-accounting-entity-id', accountingEntityId)
        .send(payload);

      expect(response.status).toBe(200);
      expect(mockUpdateJournalEntryMetaUseCase).toHaveBeenCalledWith(
        journalEntryId,
        payload
      );
    });
  });

  describe('401 Response', () => {
    it('rejects an unauthenticated request before orchestration', async () => {
      const response = await request(server)
        .patch(`/api/v1/journal-entries/${journalEntryId}/meta`)
        .set('x-accounting-entity-id', accountingEntityId);

      expect(response.status).toBe(401);
      expect(mockUpdateJournalEntryMetaUseCase).not.toHaveBeenCalled();
    });
  });

  describe('409 Response', () => {
    it('maps a concurrent write conflict', async () => {
      mockUpdateJournalEntryMetaUseCase.mockRejectedValueOnce(
        new appError.Conflict()
      );

      expect((await makeRequest()).status).toBe(409);
    });
  });

  describe('400 Response', () => {
    it('maps an invalid status transition', async () => {
      mockUpdateJournalEntryMetaUseCase.mockRejectedValueOnce(
        new journalEntryError.InvalidStatusTransition()
      );

      expect((await makeRequest()).status).toBe(400);
    });
  });

  describe('422 Response', () => {
    it.each([
      { header: { memo: 10 } },
      { header: { amount: 100 } },
      { lines: [{ id: 'invalid', description: 'Line' }] },
      { lines: [{ id: journalEntryId, amount: 100 }] },
      { effectiveDate: '2026-01-01' },
    ])('rejects malformed or financial input %j', async (payload) => {
      const response = await request(server)
        .patch(`/api/v1/journal-entries/${journalEntryId}/meta`)
        .set('Authorization', 'Bearer valid-token')
        .set('x-accounting-entity-id', accountingEntityId)
        .send(payload);
      expect(response.status).toBe(422);
      expect(mockUpdateJournalEntryMetaUseCase).not.toHaveBeenCalled();
    });
  });

  describe('404 Response', () => {
    it('maps an inaccessible entry', async () => {
      mockUpdateJournalEntryMetaUseCase.mockRejectedValueOnce(
        new appError.ResourceNotFound()
      );
      expect((await makeRequest()).status).toBe(404);
    });
  });
});
