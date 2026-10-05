import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import actorEntity from '@domain/user/entities/actor.entity';
import { IUser } from '@domain/user/types/user.types';

import { mockAccountingEntityRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import accountingAppError from '@app/accounting/errors/accounting.error';
import mockTokenService from '@app/auth/contracts/__mocks__/token-service.mock';
import mockFeatureFlagService from '@app/context/contracts/__mocks__/feature-flag.service.mock';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import { ICreateSuspenseAccountDto } from '@app/ledger/dtos/suspense-account/suspense-account.dto';
import { createSuspenseAccountValidation } from '@app/ledger/dtos/suspense-account/suspense-account.dto.validation';
import { mockActorService } from '@app/user/contracts/__mocks__/actor.services.mock';
import { mockUserRepo } from '@app/user/contracts/__mocks__/user.repos.mock';

import { createSuspenseAccountUseCase } from '@infra/ioc/usecases/ledger';
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
  createSuspenseAccountUseCase: jest.fn(),
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

const ENDPOINT = '/api/v1/accounts/suspense';
const userId = '123e4567-e89b-42d3-a456-426614174001' as TEntityId;
const accountingEntityId = '123e4567-e89b-42d3-a456-426614174002' as TEntityId;
const accountId = '123e4567-e89b-42d3-a456-426614174003' as TEntityId;
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
const valid: ICreateSuspenseAccountDto = {
  name: 'Custom account',
  type: 'asset',
  currencyCode: 'NGN',
};
const created: ILedgerAccountDto = {
  version: 1,
  id: accountId,
  code: '199000',
  materializedPath: '199000',
  accountingEntityId,
  type: 'asset',
  normalBalance: 'debit',
  subType: 'suspense',
  behavior: 'default',
  isControlAccount: false,
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
const mockCreate = jest.mocked(createSuspenseAccountUseCase);

describe('POST /accounts/suspense', () => {
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
      zodValidationRunner(createSuspenseAccountValidation, payload);
      return {
        ...created,
        type: payload.type,
        normalBalance: payload.type === 'asset' ? 'debit' : 'credit',
        code: payload.type === 'asset' ? '199000' : '299000',
        materializedPath: payload.type === 'asset' ? '199000' : '299000',
      };
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
    it('returns one created DTO and security headers', async () => {
      const response = await send();
      expect(response.status).toBe(201);
      expect(response.body).toEqual(JSON.parse(JSON.stringify(created)));
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(mockCreate).toHaveBeenCalledWith(valid);
    });
    it('creates the liability variant independently', async () => {
      const payload = { ...valid, type: 'liability' };
      const response = await send(payload);
      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        type: 'liability',
        code: '299000',
        materializedPath: '299000',
      });
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
    it.each([
      'subType',
      'behavior',
      'controlAccountId',
      'isControlAccount',
      'createdBy',
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
  });
  describe('400 Response', () => {
    it('maps domain validation failures', async () => {
      mockCreate.mockRejectedValueOnce(new ledgerAccountError.InvalidName());
      expect((await send()).status).toBe(400);
    });
  });
  describe('404 Response', () => {
    it('maps a missing accounting entity', async () => {
      mockCreate.mockRejectedValueOnce(
        new accountingAppError.ActiveEntityNotFound()
      );
      expect((await send()).status).toBe(404);
    });
  });
  describe('409 Response', () => {
    it('maps a duplicate entity/type/currency to conflict', async () => {
      mockCreate.mockRejectedValueOnce(
        new ledgerAccountError.SuspenseAccountAlreadyExists()
      );
      const response = await send();
      expect(response.status).toBe(409);
      expect(JSON.stringify(response.body)).toContain(
        'ledger_error_suspense_account_already_exists_conflict'
      );
    });
  });
  describe('500 Response', () => {
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
