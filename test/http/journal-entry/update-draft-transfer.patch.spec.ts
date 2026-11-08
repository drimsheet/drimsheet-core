import { Server } from 'node:http';

import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';
import repoError from '@shared/values/errors/repo.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag-app.service.mock';

import { tokenAppService } from '@infra/ioc/services/auth';
import { updateDraftTransferUseCase } from '@infra/ioc/usecases/journal-entry';
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
  updateDraftTransferUseCase: jest.fn(),
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
const actorId = 'a1111111-1111-4111-8111-111111111111' as TEntityId;
const now = new Date('2026-09-22T10:00:00.000Z');
const path = `/api/v1/journal-entries/transfer/${journalEntryId}`;
const draft = {
  id: journalEntryId,
  accountingEntityId,
  sourceType: 'transfer',
  memo: 'Revised draft',
  status: 'draft',
  postedAt: null,
  voidedAt: null,
  voidingEntryId: null,
  createdBy: actorId,
  createdAt: now,
  updatedAt: now,
  attachments: [],
  lines: [],
} satisfies Awaited<ReturnType<typeof updateDraftTransferUseCase>>;

describe('PATCH /journal-entries/transfer/{id}', () => {
  let server: Server;
  const mockGetAuthUser = jest.mocked(tokenAppService.getAuthUser);
  const mockFindUser = jest.mocked(userRepos.user.findById);
  const mockFindAccountingEntity = jest.mocked(
    accountingRepos.accountingEntity.findByIdAndUserId
  );
  const mockUpdateDraftTransfer = jest.mocked(updateDraftTransferUseCase);

  beforeEach(async () => {
    jest.clearAllMocks();
    mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(true);
    mockGetAuthUser.mockResolvedValue({ id: userId });
    mockFindUser.mockResolvedValue({
      createdBy: actorId,
      actorId,
      id: userId,
    } as IUser);
    mockFindAccountingEntity.mockResolvedValue({
      createdBy: actorId,
      id: accountingEntityId,
      ownerId: userId,
      functionalCurrencyCode: 'NGN',
      jurisdictionCode: 'NG',
    } as IAccountingEntity);
    mockUpdateDraftTransfer.mockResolvedValue(draft);
    server = await startTestServer(createApplication());
  });

  afterEach(async () => {
    await closeTestServer(server);
  });

  const patchDraft = () =>
    request(server)
      .patch(path)
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntityId);

  describe('200 Response', () => {
    it('passes a memo-only edit through and returns the draft', async () => {
      const payload = { memo: draft.memo };
      const response = await patchDraft().send(payload);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ...draft,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
      expect(mockUpdateDraftTransfer).toHaveBeenCalledWith(
        journalEntryId,
        payload
      );
    });

    it('parses the exchange rate date in a partial line edit', async () => {
      const exchangeRate = {
        baseCurrencyCode: 'USD',
        targetCurrencyCode: 'NGN',
        rate: 1500,
        type: 'negotiated',
        source: 'Bank',
        asOf: now,
      };
      const response = await patchDraft().send({
        destinationLine: {
          exchangeRate: { ...exchangeRate, asOf: now.toISOString() },
        },
      });

      expect(response.status).toBe(200);
      expect(mockUpdateDraftTransfer).toHaveBeenCalledWith(journalEntryId, {
        destinationLine: { exchangeRate },
      });
    });

    it('passes explicit nulls through on a partial charge edit', async () => {
      const payload = {
        chargeLines: [
          { counterpartyId: null, exchangeRate: null, description: null },
        ],
      };

      expect((await patchDraft().send(payload)).status).toBe(200);
      expect(mockUpdateDraftTransfer).toHaveBeenCalledWith(
        journalEntryId,
        payload
      );
    });

    it('passes an empty charge replacement through to the use case', async () => {
      const payload = { chargeLines: [] };

      expect((await patchDraft().send(payload)).status).toBe(200);
      expect(mockUpdateDraftTransfer).toHaveBeenCalledWith(
        journalEntryId,
        payload
      );
    });
  });

  describe('400 Response', () => {
    it('maps a journal that cannot be edited as a draft transfer', async () => {
      mockUpdateDraftTransfer.mockRejectedValueOnce(
        new journalEntryError.RectificationNotPermitted()
      );

      expect((await patchDraft().send({})).status).toBe(400);
    });
  });

  describe('401 Response', () => {
    it('requires authentication before calling the use case', async () => {
      const response = await request(server)
        .patch(path)
        .set('x-accounting-entity-id', accountingEntityId)
        .send({});

      expect(response.status).toBe(401);
      expect(mockUpdateDraftTransfer).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('requires Alpha 1 access before calling the use case', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValueOnce(false);

      expect((await patchDraft().send({})).status).toBe(403);
      expect(mockUpdateDraftTransfer).not.toHaveBeenCalled();
    });
  });

  describe('404 Response', () => {
    it('maps an unavailable draft transfer', async () => {
      mockUpdateDraftTransfer.mockRejectedValueOnce(
        new appError.ResourceNotFound()
      );

      expect((await patchDraft().send({})).status).toBe(404);
    });
  });

  describe('409 Response', () => {
    it('maps a concurrent update conflict', async () => {
      mockUpdateDraftTransfer.mockRejectedValueOnce(
        new repoError.VersionNotFound()
      );

      expect((await patchDraft().send({})).status).toBe(409);
    });
  });

  describe('422 Response', () => {
    it.each([
      { effectiveDate: now.toISOString() },
      { postedAt: now.toISOString() },
      { destinationLine: { side: 'credit' } },
      { sourceLine: { counterpartyId: accountingEntityId } },
      { destinationLine: { counterpartyId: accountingEntityId } },
      { chargeLines: [{ sequenceOrder: 'first' }] },
    ])('rejects unsupported or malformed input %j', async (payload) => {
      expect((await patchDraft().send(payload)).status).toBe(422);
      expect(mockUpdateDraftTransfer).not.toHaveBeenCalled();
    });
  });
});
