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
import { IReceiptEntryReq } from '@app/journal-entry/dtos/receipt-entry/receipt-entry.dto';

import { tokenService } from '@infra/ioc/services/auth';
import { createReceiptUseCase } from '@infra/ioc/usecases/journal-entry';
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

const ENDPOINT = '/api/v1/journal-entries/receipt';
const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const accountingEntityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;

const validPayload: IReceiptEntryReq = {
  attachmentReferences: ['123e4567-e89b-12d3-a456-426614174009'],
  sourceLines: [
    {
      accountId: '123e4567-e89b-12d3-a456-426614174005',
      counterparty: { name: 'Jane Doe' },
      amount: { amount: 900, currencyCode: 'NGN', isMinorUnit: true },
      exchangeRate: null,
      description: 'Revenue line',
      sequenceOrder: 1,
    },
    {
      accountId: '123e4567-e89b-12d3-a456-426614174010',
      counterparty: { name: 'Tax Authority' },
      amount: { amount: 100, currencyCode: 'NGN', isMinorUnit: true },
      exchangeRate: null,
      description: 'VAT payable line',
      sequenceOrder: 2,
    },
  ],
  destinationLine: {
    accountId: '123e4567-e89b-12d3-a456-426614174008',
    counterparty: { name: 'Jane Doe' },
    amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
    exchangeRate: null,
    description: 'Cash line',
    sequenceOrder: 3,
  },
  effectiveDate: new Date('2026-08-06T00:00:00.000Z'),
  postedAt: null,
  memo: 'Receipt memo',
};

const accountingEntity = {
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  id: accountingEntityId,
  ownerId: userId,
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
} as IAccountingEntity;

const createdReceipt: IJournalEntryDto = {
  id: '123e4567-e89b-12d3-a456-426614174003',
  accountingEntityId,
  sourceType: 'receipt',
  memo: 'Receipt memo',
  status: 'draft',
  effectiveDate: new Date('2026-08-06T00:00:00.000Z'),
  postedAt: null,
  voidedAt: null,
  voidingEntryId: null,
  createdBy: userId,
  createdAt: new Date('2026-08-06T08:00:00.000Z'),
  updatedAt: new Date('2026-08-06T08:00:00.000Z'),
  attachments: [
    {
      url: 'https://files.example.com/receipt.pdf',
      name: 'Original receipt.pdf',
      type: 'application/pdf',
      size: 2048,
    },
  ],
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
      description: 'Revenue line',
      createdAt: new Date('2026-08-06T08:00:00.000Z'),
      updatedAt: new Date('2026-08-06T08:00:00.000Z'),
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
      description: 'Cash line',
      createdAt: new Date('2026-08-06T08:00:00.000Z'),
      updatedAt: new Date('2026-08-06T08:00:00.000Z'),
    },
  ],
};

describe('POST /journal-entries/receipt', () => {
  let app: Express;
  const mockGetAuthUser = tokenService.getAuthUser as jest.Mock;
  const mockFindUser = userRepos.user.findById as jest.Mock;
  const mockFindAccountingEntity = accountingRepos.accountingEntity
    .findByIdAndUserId as jest.Mock;
  const mockCreateReceiptUseCase = createReceiptUseCase as jest.Mock;

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
    mockCreateReceiptUseCase.mockResolvedValue(createdReceipt);
    app = createApplication();
  });

  const makeRequest = (payload: object = validPayload) =>
    request(app)
      .post(ENDPOINT)
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntityId)
      .send(payload);

  describe('201 Response', () => {
    it('returns 201 with the created receipt DTO', async () => {
      const response = await makeRequest();

      expect(response.status).toBe(201);
      expect(response.type).toBe('application/json');
      expect(response.body).toEqual({
        ...createdReceipt,
        effectiveDate: createdReceipt.effectiveDate.toISOString(),
        createdAt: createdReceipt.createdAt.toISOString(),
        updatedAt: createdReceipt.updatedAt.toISOString(),
        lines: createdReceipt.lines.map((line) => ({
          ...line,
          createdAt: line.createdAt.toISOString(),
          updatedAt: line.updatedAt.toISOString(),
        })),
      });

      expect(mockCreateReceiptUseCase).toHaveBeenCalledWith({
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
      mockCreateReceiptUseCase.mockRejectedValueOnce(
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
      mockCreateReceiptUseCase.mockRejectedValueOnce(
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
      expect(response.body.errorKey).toBe('app_error_request_invalid');
      expect(mockCreateReceiptUseCase).not.toHaveBeenCalled();
    });

    it('returns the stable invalid-reference error from claiming', async () => {
      mockCreateReceiptUseCase.mockRejectedValueOnce(
        new fileAppError.InvalidUploadReference()
      );

      const response = await makeRequest();

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        name: 'FileAppError',
        errorKey: 'app_error_file_upload_reference_invalid',
      });
    });
  });

  describe('401 Response', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await request(app)
        .post(ENDPOINT)
        .set('x-accounting-entity-id', accountingEntityId)
        .send(validPayload);

      expect(response.status).toBe(401);
      expect(mockCreateReceiptUseCase).not.toHaveBeenCalled();
    });

    it('rejects a nonexistent user', async () => {
      mockFindUser.mockResolvedValue(null);

      const response = await makeRequest();

      expect(response.status).toBe(401);
      expect(mockCreateReceiptUseCase).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      mockGetAuthUser.mockRejectedValue(new authError.ExpiredToken());

      const response = await makeRequest();

      expect(response.status).toBe(401);
      expect(response.body.errorKey).toBe(
        'auth_error_token_expired_unauthorized'
      );
      expect(mockCreateReceiptUseCase).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('rejects a user without Alpha 1 access', async () => {
      mockFeatureFlagService.canAccessAlpha1.mockResolvedValueOnce(false);

      const response = await makeRequest();

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        name: 'FeatureFlagError',
        errorKey: 'feature_flag_error_forbidden',
      });
      expect(mockCreateReceiptUseCase).not.toHaveBeenCalled();
    });

    it('rejects a caller-supplied foreign accounting entity context', async () => {
      mockFindAccountingEntity.mockResolvedValue({
        ...accountingEntity,
        ownerId: '999e4567-e89b-12d3-a456-426614174999',
      });

      const response = await makeRequest();

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        name: 'Forbidden',
        errorKey: 'app_error_forbidden',
      });
      expect(mockCreateReceiptUseCase).not.toHaveBeenCalled();
    });
  });

  describe('422 Response', () => {
    it('rejects invalid payload with extra fields (TSOA validation)', async () => {
      const invalidPayload = {
        ...validPayload,
        extraField: 'not allowed',
      };
      const response = await makeRequest(invalidPayload);

      expect(response.status).toBe(422);
      expect(response.body.errorKey).toBe('app_error_validation_error');
      expect(mockCreateReceiptUseCase).not.toHaveBeenCalled();
    });

    it('returns 422 if usecase validation fails (zod validation runner)', async () => {
      const validationErrors = [
        { field: 'sourceLines.0.accountId', message: 'required' },
      ];
      mockCreateReceiptUseCase.mockRejectedValueOnce(
        new appError.UnprocessableEntity(validationErrors)
      );

      const response = await makeRequest();

      expect(response.status).toBe(422);
      expect(response.body.errorKey).toBe('app_error_validation_error');
      expect(response.body.validationErrors).toEqual(validationErrors);
    });

    it('rejects the legacy receipt line shape before orchestration', async () => {
      const legacyPayload = {
        ...validPayload,
        sourceLine: validPayload.sourceLines[0],
        destinationLines: [validPayload.destinationLine],
        sourceLines: undefined,
        destinationLine: undefined,
      };

      const response = await makeRequest(legacyPayload);

      expect(response.status).toBe(422);
      expect(response.body.errorKey).toBe('app_error_validation_error');
      expect(mockCreateReceiptUseCase).not.toHaveBeenCalled();
    });
  });

  describe('500 Response', () => {
    it('rejects a missing active accounting entity header', async () => {
      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .send(validPayload);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        name: 'InternalServerError',
        errorKey: 'app_error_unexpected',
      });
      expect(mockCreateReceiptUseCase).not.toHaveBeenCalled();
    });

    it('sanitizes unexpected internal errors', async () => {
      mockCreateReceiptUseCase.mockRejectedValueOnce(
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
