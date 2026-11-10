import { Server } from 'node:http';

import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag-app.service.mock';

import { tokenAppService } from '@infra/ioc/services/auth';
import { voidAndReplacePaymentUseCase } from '@infra/ioc/usecases/journal-entry';
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
  voidAndReplacePaymentUseCase: jest.fn(),
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
const path = `/api/v1/journal-entries/payment/${journalEntryId}/void-and-replace`;
const replacement = {
  id: '123e4567-e89b-12d3-a456-426614174004',
  accountingEntityId,
  sourceType: 'payment',
  memo: 'Rent payment',
  status: 'posted',
  effectiveDate: now,
  postedAt: now,
  voidedAt: null,
  voidingEntryId: null,
  createdBy: actorId,
  createdAt: now,
  updatedAt: now,
  attachments: [],
  lines: [],
} satisfies Awaited<ReturnType<typeof voidAndReplacePaymentUseCase>>;

describe('POST /journal-entries/payment/{id}/void-and-replace', () => {
  let server: Server;
  const mockGetAuthUser = jest.mocked(tokenAppService.getAuthUser);
  const mockFindUser = jest.mocked(userRepos.user.findById);
  const mockFindAccountingEntity = jest.mocked(
    accountingRepos.accountingEntity.findByIdAndUserId
  );
  const mockVoidAndReplacePayment = jest.mocked(voidAndReplacePaymentUseCase);

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
    mockVoidAndReplacePayment.mockResolvedValue(replacement);
    server = await startTestServer(createApplication());
  });

  afterEach(async () => {
    await closeTestServer(server);
  });

  const requestReplacement = () =>
    request(server)
      .post(path)
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntityId);

  const sourceLine = {
    accountId: '123e4567-e89b-12d3-a456-426614174005',
    counterpartyId: '123e4567-e89b-12d3-a456-426614174006',
    amount: { amount: 100, currencyCode: 'USD', isMinorUnit: false },
    exchangeRate: {
      baseCurrencyCode: 'USD',
      targetCurrencyCode: 'NGN',
      rate: 1500,
      type: 'negotiated',
      source: 'Bank',
      asOf: now,
    },
    sequenceOrder: 1,
    description: null,
  };
  const payload = {
    effectiveDate: now,
    postedAt: now,
    memo: 'Corrected rent payment',
    sourceLine,
    destinationLines: [
      {
        accountId: '123e4567-e89b-12d3-a456-426614174007',
        counterpartyId: sourceLine.counterpartyId,
        amount: { amount: 150000, currencyCode: 'NGN', isMinorUnit: false },
        exchangeRate: null,
        sequenceOrder: 2,
        description: null,
      },
    ],
  };

  describe('200 Response', () => {
    it('passes corrected payment lines through and returns the posted replacement', async () => {
      const response = await requestReplacement().send(payload);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ...replacement,
        effectiveDate: now.toISOString(),
        postedAt: now.toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
      expect(mockVoidAndReplacePayment).toHaveBeenCalledWith(
        journalEntryId,
        payload
      );
    });

    it('accepts a draft replacement with a corrected effective date', async () => {
      const effectiveDate = new Date('2026-09-20T10:00:00.000Z');
      const draft = {
        ...replacement,
        status: 'draft' as const,
        effectiveDate,
        postedAt: null,
      };
      mockVoidAndReplacePayment.mockResolvedValueOnce(draft);
      const request = { ...payload, effectiveDate, postedAt: null };

      const response = await requestReplacement().send(request);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'draft',
        effectiveDate: effectiveDate.toISOString(),
        postedAt: null,
      });
      expect(mockVoidAndReplacePayment).toHaveBeenCalledWith(
        journalEntryId,
        request
      );
    });
  });

  describe('401 Response', () => {
    it('requires authentication before calling the use case', async () => {
      const response = await request(server)
        .post(path)
        .set('x-accounting-entity-id', accountingEntityId)
        .send(payload);

      expect(response.status).toBe(401);
      expect(mockVoidAndReplacePayment).not.toHaveBeenCalled();
    });
  });

  describe('422 Response', () => {
    it('rejects an invalid posting date before calling the use case', async () => {
      const response = await requestReplacement().send({
        ...payload,
        postedAt: 'invalid-date',
      });

      expect(response.status).toBe(422);
      expect(mockVoidAndReplacePayment).not.toHaveBeenCalled();
    });
  });
});
