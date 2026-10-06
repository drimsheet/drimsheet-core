import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import { IUser } from '@domain/user/types/user.types';

import authError from '@app/auth/errors/auth.error';
import mockFeatureFlagService from '@app/context/contracts/__mocks__/feature-flag.service.mock';
import fileAppError from '@app/file/errors/file.error';
import { IJournalEntryDto } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import { IPaymentEntryReq } from '@app/journal-entry/dtos/payment-entry/payment-entry.dto';

import { tokenService } from '@infra/ioc/services/auth';
import { createPaymentUseCase } from '@infra/ioc/usecases/journal-entry';
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
  createPaymentUseCase: jest.fn(),
  createReceiptUseCase: jest.fn(),
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

const ENDPOINT = '/api/v1/journal-entries/payment';
const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const accountingEntityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;

const validPayload: IPaymentEntryReq = {
  attachmentReferences: ['123e4567-e89b-12d3-a456-426614174009'],
  sourceLine: {
    accountId: '123e4567-e89b-12d3-a456-426614174005',
    counterparty: { name: 'Payment Vendor' },
    amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
    exchangeRate: null,
    description: 'Bank payment',
    sequenceOrder: 1,
  },
  destinationLines: [
    {
      accountId: '123e4567-e89b-12d3-a456-426614174008',
      counterparty: { name: 'Payment Vendor' },
      amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
      exchangeRate: null,
      description: 'Rent expense',
      sequenceOrder: 2,
    },
  ],
  effectiveDate: new Date('2026-08-30T00:00:00.000Z'),
  postedAt: null,
  memo: 'Payment memo',
};

const accountingEntity = {
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  id: accountingEntityId,
  ownerId: userId,
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
} as IAccountingEntity;

const createdPayment: IJournalEntryDto = {
  id: '123e4567-e89b-12d3-a456-426614174003',
  accountingEntityId,
  sourceType: 'payment',
  memo: 'Payment memo',
  status: 'draft',
  effectiveDate: new Date('2026-08-30T00:00:00.000Z'),
  postedAt: null,
  voidedAt: null,
  voidingEntryId: null,
  createdBy: userId,
  createdAt: new Date('2026-08-30T08:00:00.000Z'),
  updatedAt: new Date('2026-08-30T08:00:00.000Z'),
  attachments: [],
  lines: [
    {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: '123e4567-e89b-12d3-a456-426614174004',
      entryId: '123e4567-e89b-12d3-a456-426614174003',
      accountId: '123e4567-e89b-12d3-a456-426614174005',
      counterpartyId: '123e4567-e89b-12d3-a456-426614174006',
      sequenceOrder: 1,
      amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
      exchangeRate: null,
      functionalAmount: {
        amount: 1000,
        currencyCode: 'NGN',
        isMinorUnit: true,
      },
      side: 'credit',
      description: 'Bank payment',
      createdAt: new Date('2026-08-30T08:00:00.000Z'),
      updatedAt: new Date('2026-08-30T08:00:00.000Z'),
    },
    {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: '123e4567-e89b-12d3-a456-426614174007',
      entryId: '123e4567-e89b-12d3-a456-426614174003',
      accountId: '123e4567-e89b-12d3-a456-426614174008',
      counterpartyId: '123e4567-e89b-12d3-a456-426614174006',
      sequenceOrder: 2,
      amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
      exchangeRate: null,
      functionalAmount: {
        amount: 1000,
        currencyCode: 'NGN',
        isMinorUnit: true,
      },
      side: 'debit',
      description: 'Rent expense',
      createdAt: new Date('2026-08-30T08:00:00.000Z'),
      updatedAt: new Date('2026-08-30T08:00:00.000Z'),
    },
  ],
};

describe('POST /journal-entries/payment', () => {
  let app: Express;
  const mockGetAuthUser = tokenService.getAuthUser as jest.Mock;
  const mockFindUser = userRepos.user.findById as jest.Mock;
  const mockFindAccountingEntity = accountingRepos.accountingEntity
    .findByIdAndUserId as jest.Mock;
  const mockCreatePaymentUseCase = createPaymentUseCase as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFeatureFlagService.canAccessAlpha1.mockResolvedValue(true);
    mockGetAuthUser.mockResolvedValue({ id: userId });
    mockFindUser.mockResolvedValue({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: userId,
    } as IUser);
    mockFindAccountingEntity.mockResolvedValue(accountingEntity);
    mockCreatePaymentUseCase.mockResolvedValue(createdPayment);
    app = createApplication();
  });

  const makeRequest = (payload: object = validPayload) =>
    request(app)
      .post(ENDPOINT)
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntityId)
      .send(payload);

  describe('201 Response', () => {
    it('returns the created payment DTO', async () => {
      const response = await makeRequest();

      expect(response.status).toBe(201);
      expect(response.type).toBe('application/json');
      expect(response.body).toEqual({
        ...createdPayment,
        effectiveDate: createdPayment.effectiveDate.toISOString(),
        createdAt: createdPayment.createdAt.toISOString(),
        updatedAt: createdPayment.updatedAt.toISOString(),
        lines: createdPayment.lines.map((line) => ({
          ...line,
          createdAt: line.createdAt.toISOString(),
          updatedAt: line.updatedAt.toISOString(),
        })),
      });
      expect(mockCreatePaymentUseCase).toHaveBeenCalledWith({
        ...validPayload,
        effectiveDate: expect.any(Date),
      });
    });
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
      mockCreatePaymentUseCase.mockRejectedValueOnce(
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

    it('returns the dedicated draft-counterparty posting error', async () => {
      mockCreatePaymentUseCase.mockRejectedValueOnce(
        new journalEntryError.DraftCounterpartyNotAllowed()
      );
      const response = await makeRequest();
      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe(
        'journal_entry_error_draft_counterparty_not_allowed_invalid'
      );
    });

    it('rejects an invalid accounting entity ID format', async () => {
      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .set('x-accounting-entity-id', 'invalid-uuid')
        .send(validPayload);

      expect(response.status).toBe(400);
      expect(mockCreatePaymentUseCase).not.toHaveBeenCalled();
    });

    it('returns an invalid attachment reference error', async () => {
      mockCreatePaymentUseCase.mockRejectedValueOnce(
        new fileAppError.InvalidUploadReference()
      );

      const response = await makeRequest();

      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe(
        'app_error_file_upload_reference_invalid'
      );
    });
  });

  describe('401 Response', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await request(app)
        .post(ENDPOINT)
        .set('x-accounting-entity-id', accountingEntityId)
        .send(validPayload);

      expect(response.status).toBe(401);
      expect(mockCreatePaymentUseCase).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      mockGetAuthUser.mockRejectedValue(new authError.ExpiredToken());

      const response = await makeRequest();

      expect(response.status).toBe(401);
      expect(response.body.errorKey).toBe(
        'auth_error_token_expired_unauthorized'
      );
    });
  });

  describe('403 Response', () => {
    it('rejects a user without Alpha 1 access', async () => {
      mockFeatureFlagService.canAccessAlpha1.mockResolvedValueOnce(false);

      const response = await makeRequest();

      expect(response.status).toBe(403);
      expect(mockCreatePaymentUseCase).not.toHaveBeenCalled();
    });

    it('rejects a foreign accounting entity context', async () => {
      mockFindAccountingEntity.mockResolvedValue({
        ...accountingEntity,
        ownerId: '999e4567-e89b-12d3-a456-426614174999',
      });

      const response = await makeRequest();

      expect(response.status).toBe(403);
      expect(mockCreatePaymentUseCase).not.toHaveBeenCalled();
    });
  });

  describe('422 Response', () => {
    it('rejects extra request fields before orchestration', async () => {
      const response = await makeRequest({
        ...validPayload,
        extraField: 'not allowed',
      });

      expect(response.status).toBe(422);
      expect(mockCreatePaymentUseCase).not.toHaveBeenCalled();
    });

    it('returns use-case validation failures', async () => {
      const validationErrors = [
        { field: 'destinationLines', message: 'required' },
      ];
      mockCreatePaymentUseCase.mockRejectedValueOnce(
        new appError.UnprocessableEntity(validationErrors)
      );

      const response = await makeRequest();

      expect(response.status).toBe(422);
      expect(response.body.validationErrors).toEqual(validationErrors);
    });
  });

  describe('500 Response', () => {
    it('rejects a missing active accounting entity header', async () => {
      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .send(validPayload);

      expect(response.status).toBe(500);
      expect(mockCreatePaymentUseCase).not.toHaveBeenCalled();
    });

    it('sanitizes unexpected errors', async () => {
      mockCreatePaymentUseCase.mockRejectedValueOnce(
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
