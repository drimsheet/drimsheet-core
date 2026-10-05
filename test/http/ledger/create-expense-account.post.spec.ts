import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import actorEntity from '@domain/user/entities/actor.entity';
import { IUser } from '@domain/user/types/user.types';

import { mockAccountingEntityRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import mockTokenService from '@app/auth/contracts/__mocks__/token-service.mock';
import mockFeatureFlagService from '@app/context/contracts/__mocks__/feature-flag.service.mock';
import { ICreateExpenseAccountDto } from '@app/ledger/dtos/expense-account/expense-account.dto';
import { createExpenseAccountValidation } from '@app/ledger/dtos/expense-account/expense-account.dto.validation';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import { mockActorService } from '@app/user/contracts/__mocks__/actor.services.mock';
import { mockUserRepo } from '@app/user/contracts/__mocks__/user.repos.mock';

import { createExpenseAccountUseCase } from '@infra/ioc/usecases/ledger';
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
    default: jest.requireActual(
      '@app/context/contracts/__mocks__/feature-flag.service.mock'
    ).default,
  })
);
jest.mock('@infra/ioc/services/auth', () => ({
  tokenService: jest.requireActual(
    '@app/auth/contracts/__mocks__/token-service.mock'
  ).default,
}));
jest.mock('@infra/ioc/usecases/ledger', () => ({
  createExpenseAccountUseCase: jest.fn(),
}));
jest.mock('@infra/persistence/repos/accounting', () => ({
  __esModule: true,
  default: {
    accountingEntity: jest.requireActual(
      '@app/accounting/contracts/__mocks__/accounting.repos.mock'
    ).mockAccountingEntityRepo,
  },
}));
jest.mock('@infra/persistence/repos/user', () => ({
  __esModule: true,
  default: {
    user: jest.requireActual('@app/user/contracts/__mocks__/user.repos.mock')
      .mockUserRepo,
  },
}));
jest.mock('@infra/persistence/repos/ledger', () => ({
  __esModule: true,
  default: {
    ledgerAccount: jest.requireActual(
      '@app/ledger/contracts/__mocks__/ledger.repos.mock'
    ).mockLedgerAccountRepo,
    ledgerAccountBalance: jest.requireActual(
      '@app/ledger/contracts/__mocks__/ledger.repos.mock'
    ).mockLedgerAccountBalanceRepo,
  },
}));

const ENDPOINT = '/api/v1/accounts/expenses';
const userId = '123e4567-e89b-42d3-a456-426614174001' as TEntityId;
const accountingEntityId = '123e4567-e89b-42d3-a456-426614174002' as TEntityId;
const accountId = '123e4567-e89b-42d3-a456-426614174003' as TEntityId;
const controlAccountId = '123e4567-e89b-42d3-a456-426614174004' as TEntityId;
const actor = actorEntity.makeUser({
  email: 'posting@example.com',
  displayName: 'Posting Owner',
})[0];
const accountingEntity = {
  id: accountingEntityId,
  ownerId: userId,
  createdBy: actor.id,
  functionalCurrencyCode: 'NGN',
} as IAccountingEntity;
const valid: ICreateExpenseAccountDto = {
  name: 'Custom account',
  isControlAccount: false,
  behavior: 'bank_charge',
};
const created: ILedgerAccountDto = {
  version: 1,
  id: accountId,
  code: '507001',
  materializedPath: 'parent.507001',
  accountingEntityId,
  type: 'expense',
  normalBalance: 'debit',
  subType: 'bank_charge',
  behavior: 'bank_charge',
  isControlAccount: false,
  controlAccountId,
  name: valid.name,
  status: 'active',
  contraAccountRule: 'contra_not_permitted',
  adjunctAccountRule: 'adjunct_not_permitted',
  openingBalanceDate: null,
  createdBy: actor.id,
  createdAt: new Date('2026-09-01'),
  updatedAt: new Date('2026-09-01'),
  balance: { amount: 0, currencyCode: 'NGN', isMinorUnit: true },
  functionalBalance: { amount: 0, currencyCode: 'NGN', isMinorUnit: true },
};
const mockCreate = jest.mocked(createExpenseAccountUseCase);

describe('POST /accounts/expenses', () => {
  let app: Express;
  beforeEach(() => {
    jest.resetAllMocks();
    mockFeatureFlagService.canAccessAlpha1.mockResolvedValue(true);
    mockTokenService.getAuthUser.mockResolvedValue({ id: userId });
    mockUserRepo.findById.mockResolvedValue({
      id: userId,
      actorId: actor.id,
      createdBy: actor.id,
    } as IUser);
    mockActorService.resolveUser.mockResolvedValue(actor);
    mockAccountingEntityRepo.findByIdAndUserId.mockResolvedValue(
      accountingEntity
    );
    mockCreate.mockImplementation(async (payload) => {
      zodValidationRunner(createExpenseAccountValidation, payload);
      return created;
    });
    app = createApplication();
  });
  const send = (payload: object = valid) =>
    request(app)
      .post(ENDPOINT)
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntityId)
      .send(payload);
  describe('201 Response', () => {
    it.each(['active', 'draft'] as const)(
      'accepts %s creation and returns its status',
      async (status) => {
        mockCreate.mockResolvedValueOnce({ ...created, status });
        const response = await send({ ...valid, status });
        expect(response.status).toBe(201);
        expect(response.body.status).toBe(status);
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({ status })
        );
      }
    );

    it('returns one created DTO and security headers', async () => {
      const response = await send();
      expect(response.status).toBe(201);
      expect(response.body).toEqual(JSON.parse(JSON.stringify(created)));
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(mockCreate).toHaveBeenCalledWith(valid);
    });
    it('forwards an optional parent ID', async () => {
      const payload = { ...valid, controlAccountId };
      expect((await send(payload)).status).toBe(201);
      expect(mockCreate).toHaveBeenCalledWith(payload);
    });
  });
  describe('401 Response', () => {
    it('requires authentication', async () => {
      const response = await request(app)
        .post(ENDPOINT)
        .set('x-accounting-entity-id', accountingEntityId)
        .send(valid);
      expect(response.status).toBe(401);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });
  describe('403 Response', () => {
    it('requires Alpha 1 access', async () => {
      mockFeatureFlagService.canAccessAlpha1.mockResolvedValue(false);
      expect((await send()).status).toBe(403);
      expect(mockCreate).not.toHaveBeenCalled();
    });
    it('rejects access to another owner entity', async () => {
      mockAccountingEntityRepo.findByIdAndUserId.mockResolvedValue({
        ...accountingEntity,
        ownerId: accountId,
      });
      expect((await send()).status).toBe(403);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });
  describe('422 Response', () => {
    it.each(['archived', 'invalid'])(
      'rejects unsupported creation status %s',
      async (status) => {
        const response = await send({ ...valid, status });
        expect(response.status).toBe(422);
        expect(mockCreate).not.toHaveBeenCalled();
      }
    );

    it.each([
      'subType',
      'type',
      'controlAccount',
      'code',
      'key',
      'openingBalance',
      'accountingEntityId',
    ])('rejects unexpected field %s before orchestration', async (field) => {
      expect((await send({ ...valid, [field]: 'forged' })).status).toBe(422);
      expect(mockCreate).not.toHaveBeenCalled();
    });
    it('rejects arrays before orchestration', async () => {
      expect((await send([valid])).status).toBe(422);
      expect(mockCreate).not.toHaveBeenCalled();
    });
    it('rejects invalid primitive fields', async () => {
      expect((await send({ ...valid, name: '' })).status).toBe(422);
    });
    it.each([undefined, 'default', 'unsupported'])(
      'rejects missing or unsupported behavior %s',
      async (behavior) => {
        expect((await send({ ...valid, behavior })).status).toBe(422);
        expect(mockCreate).not.toHaveBeenCalled();
      }
    );
  });
  describe('400 Response', () => {
    it('maps domain validation failures', async () => {
      mockCreate.mockRejectedValueOnce(
        new ledgerAccountError.InvalidControlAccount()
      );
      expect((await send()).status).toBe(400);
    });
  });
  describe('404 Response', () => {
    it('maps a missing selected parent', async () => {
      mockCreate.mockRejectedValueOnce(
        new ledgerAccountError.ControlAccountIdNotFound()
      );
      const response = await send({ ...valid, controlAccountId });
      expect(response.status).toBe(404);
      expect(response.body.errorKey).toBe(
        'ledger_error_control_account_id_not_found'
      );
    });
  });
  describe('500 Response', () => {
    it('preserves the unexpected-error mapping for a missing default control', async () => {
      mockCreate.mockRejectedValueOnce(
        new ledgerAccountError.ControlAccountNotFound()
      );
      expect((await send()).status).toBe(500);
    });
    it('sanitizes unexpected failures', async () => {
      mockCreate.mockRejectedValueOnce(new Error('private database detail'));
      const response = await send();
      expect(response.status).toBe(500);
      expect(JSON.stringify(response.body)).not.toContain(
        'private database detail'
      );
    });
  });
});
