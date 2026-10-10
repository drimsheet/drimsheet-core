import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import { IUser } from '@domain/user/types/user.types';

import authError from '@app/auth/errors/auth.error';
import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag.service.mock';
import fileAppError from '@app/file/errors/file.error';
import { IJournalEntryDto } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import { ITransferEntryReq } from '@app/journal-entry/dtos/transfer-entry/transfer-entry.dto';

import { tokenAppService } from '@infra/ioc/services/auth';
import { createTransferUseCase } from '@infra/ioc/usecases/journal-entry';
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

const ENDPOINT = '/api/v1/journal-entries/transfer';
const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const accountingEntityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;

const validPayload: ITransferEntryReq = {
  attachmentReferences: ['123e4567-e89b-12d3-a456-426614174009'],
  sourceLine: {
    accountId: '123e4567-e89b-12d3-a456-426614174005',
    amount: { amount: 1050, currencyCode: 'NGN', isMinorUnit: true },
    exchangeRate: null,
    description: 'Transfer from bank',
    sequenceOrder: 1,
  },
  destinationLine: {
    accountId: '123e4567-e89b-12d3-a456-426614174008',
    amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
    exchangeRate: null,
    description: 'Transfer to petty cash',
    sequenceOrder: 2,
  },
  chargeLines: [
    {
      accountId: '123e4567-e89b-12d3-a456-426614174011',
      counterparty: { name: 'Transfer provider' },
      amount: { amount: 50, currencyCode: 'NGN', isMinorUnit: true },
      exchangeRate: null,
      description: 'Transfer fee',
      sequenceOrder: 3,
    },
  ],
  effectiveDate: new Date('2026-08-30T00:00:00.000Z'),
  postedAt: null,
  memo: 'Transfer memo',
};

const accountingEntity = {
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  id: accountingEntityId,
  ownerId: userId,
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
} as IAccountingEntity;

const createdTransfer: IJournalEntryDto = {
  id: '123e4567-e89b-12d3-a456-426614174003',
  accountingEntityId,
  sourceType: 'transfer',
  memo: 'Transfer memo',
  status: 'draft',
  effectiveDate: new Date('2026-08-30T00:00:00.000Z'),
  postedAt: null,
  voidedAt: null,
  voidingEntryId: null,
  createdBy: userId,
  createdAt: new Date('2026-08-30T08:00:00.000Z'),
  updatedAt: new Date('2026-08-30T08:00:00.000Z'),
  attachments: [
    {
      url: 'https://files.example.com/transfer.pdf',
      name: 'transfer.pdf',
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
      counterpartyId: null,
      sequenceOrder: 1,
      amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
      exchangeRate: null,
      functionalAmount: {
        amount: 1000,
        currencyCode: 'NGN',
        isMinorUnit: true,
      },
      side: 'credit',
      description: 'Transfer from bank',
      createdAt: new Date('2026-08-30T08:00:00.000Z'),
      updatedAt: new Date('2026-08-30T08:00:00.000Z'),
    },
    {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: '123e4567-e89b-12d3-a456-426614174007',
      entryId: '123e4567-e89b-12d3-a456-426614174003',
      accountId: '123e4567-e89b-12d3-a456-426614174008',
      counterpartyId: null,
      sequenceOrder: 2,
      amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
      exchangeRate: null,
      functionalAmount: {
        amount: 1000,
        currencyCode: 'NGN',
        isMinorUnit: true,
      },
      side: 'debit',
      description: 'Transfer to petty cash',
      createdAt: new Date('2026-08-30T08:00:00.000Z'),
      updatedAt: new Date('2026-08-30T08:00:00.000Z'),
    },
  ],
};

describe('POST /journal-entries/transfer', () => {
  let app: Express;
  const mockGetAuthUser = tokenAppService.getAuthUser as jest.Mock;
  const mockFindUser = userRepos.user.findById as jest.Mock;
  const mockFindAccountingEntity = accountingRepos.accountingEntity
    .findByIdAndUserId as jest.Mock;
  const mockCreateTransferUseCase = createTransferUseCase as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(true);
    mockGetAuthUser.mockResolvedValue({ id: userId });
    mockFindUser.mockResolvedValue({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: userId,
    } as IUser);
    mockFindAccountingEntity.mockResolvedValue(accountingEntity);
    mockCreateTransferUseCase.mockResolvedValue(createdTransfer);
    app = createApplication();
  });

  const makeRequest = (payload: object = validPayload) =>
    request(app)
      .post(ENDPOINT)
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntityId)
      .send(payload);

  describe('201 Response', () => {
    it('returns the created transfer DTO', async () => {
      const response = await makeRequest();

      expect(response.status).toBe(201);
      expect(response.type).toBe('application/json');
      expect(response.body).toEqual({
        ...createdTransfer,
        effectiveDate: createdTransfer.effectiveDate.toISOString(),
        createdAt: createdTransfer.createdAt.toISOString(),
        updatedAt: createdTransfer.updatedAt.toISOString(),
        lines: createdTransfer.lines.map((line) => ({
          ...line,
          createdAt: line.createdAt.toISOString(),
          updatedAt: line.updatedAt.toISOString(),
        })),
      });
      expect(mockCreateTransferUseCase).toHaveBeenCalledWith({
        ...validPayload,
        effectiveDate: expect.any(Date),
      });
    });

    it('accepts a transfer without charge lines', async () => {
      const response = await makeRequest({ ...validPayload, chargeLines: [] });

      expect(response.status).toBe(201);
      expect(mockCreateTransferUseCase).toHaveBeenCalledWith(
        expect.objectContaining({ chargeLines: [] })
      );
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
      mockCreateTransferUseCase.mockRejectedValueOnce(
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
      mockCreateTransferUseCase.mockRejectedValueOnce(
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
      expect(mockCreateTransferUseCase).not.toHaveBeenCalled();
    });

    it('returns an invalid attachment reference error', async () => {
      mockCreateTransferUseCase.mockRejectedValueOnce(
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
      expect(mockCreateTransferUseCase).not.toHaveBeenCalled();
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
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValueOnce(false);

      const response = await makeRequest();

      expect(response.status).toBe(403);
      expect(mockCreateTransferUseCase).not.toHaveBeenCalled();
    });

    it('rejects a foreign accounting entity context', async () => {
      mockFindAccountingEntity.mockResolvedValue({
        ...accountingEntity,
        ownerId: '999e4567-e89b-12d3-a456-426614174999',
      });

      const response = await makeRequest();

      expect(response.status).toBe(403);
      expect(mockCreateTransferUseCase).not.toHaveBeenCalled();
    });
  });

  describe('422 Response', () => {
    it('rejects transfer counterparties before orchestration', async () => {
      const response = await makeRequest({
        ...validPayload,
        sourceLine: {
          ...validPayload.sourceLine,
          counterparty: { name: 'Not permitted' },
        },
      });

      expect(response.status).toBe(422);
      expect(response.body.errorKey).toBe('app_error_validation_error');
      expect(mockCreateTransferUseCase).not.toHaveBeenCalled();
    });

    it('returns use-case validation failures', async () => {
      const validationErrors = [
        { field: 'destinationLine', message: 'required' },
      ];
      mockCreateTransferUseCase.mockRejectedValueOnce(
        new appError.UnprocessableEntity(validationErrors)
      );

      const response = await makeRequest();

      expect(response.status).toBe(422);
      expect(response.body.validationErrors).toEqual(validationErrors);
    });

    it('rejects missing charge lines before orchestration', async () => {
      const { chargeLines: _chargeLines, ...payload } = validPayload;
      const response = await makeRequest(payload);

      expect(response.status).toBe(422);
      expect(response.body.errorKey).toBe('app_error_validation_error');
      expect(mockCreateTransferUseCase).not.toHaveBeenCalled();
    });

    it('rejects the obsolete plural destination shape before orchestration', async () => {
      const { destinationLine, ...payload } = validPayload;
      const response = await makeRequest({
        ...payload,
        destinationLines: [destinationLine],
      });

      expect(response.status).toBe(422);
      expect(response.body.errorKey).toBe('app_error_validation_error');
      expect(mockCreateTransferUseCase).not.toHaveBeenCalled();
    });
  });

  describe('500 Response', () => {
    it('rejects a missing active accounting entity header', async () => {
      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .send(validPayload);

      expect(response.status).toBe(500);
      expect(mockCreateTransferUseCase).not.toHaveBeenCalled();
    });

    it('sanitizes unexpected errors', async () => {
      mockCreateTransferUseCase.mockRejectedValueOnce(
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
