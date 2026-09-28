import { Express } from 'express';
import request from 'supertest';

import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import { TEntityId } from '@shared/types/uuid';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import actorEntity from '@domain/user/entities/actor.entity';
import { IUser } from '@domain/user/types/user.types';

import { mockAccountingEntityRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import mockTokenService from '@app/auth/contracts/__mocks__/token-service.mock';
import mockFeatureFlagService from '@app/context/contracts/__mocks__/feature-flag.service.mock';
import mockLedgerAccountPersistenceService from '@app/ledger/contracts/__mocks__/ledger-account-persistence.service.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import { headerAccountNameAliasesReqValidation } from '@app/ledger/dtos/header-account/header-account.dto.validation';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import makeSetupHeaderAccountsUsecase from '@app/ledger/usecases/setup-header-accounts.usecase';
import { mockActorService } from '@app/user/contracts/__mocks__/actor.services.mock';
import { mockUserRepo } from '@app/user/contracts/__mocks__/user.repos.mock';

import * as ledgerServices from '@infra/ioc/services/ledger';
import { setupHeaderAccountsUseCase } from '@infra/ioc/usecases/ledger';
import appContext from '@infra/runtime/app-context';
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
  setupHeaderAccountsUseCase: jest.fn(),
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

const ENDPOINT = '/api/v1/ledger/header-accounts/setup';
const userId = '123e4567-e89b-42d3-a456-426614174001' as TEntityId;
const accountingEntityId = '123e4567-e89b-42d3-a456-426614174002' as TEntityId;
const actor = actorEntity.makeUser({
  email: 'headers@example.com',
  displayName: 'Header Owner',
})[0];
const accountingEntity = {
  id: accountingEntityId,
  ownerId: userId,
  createdBy: actor.id,
  functionalCurrencyCode: 'NGN',
} as IAccountingEntity;
const setup = makeSetupHeaderAccountsUsecase({
  ...ledgerServices,
  appContext,
  repoService: mockRepoService,
  eventBus: mockEventBus,
  ledgerAccountPersistenceService: mockLedgerAccountPersistenceService,
});

describe('POST /ledger/header-accounts/setup', () => {
  let app: Express;
  const mockSetup = jest.mocked(setupHeaderAccountsUseCase);

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
    mockLedgerAccountRepo.findByCode.mockResolvedValue(null);
    mockRepoService.runInTransaction.mockImplementation(async (fn) => fn({}));
    mockLedgerAccountPersistenceService.create.mockResolvedValue();
    mockEventBus.publish.mockResolvedValue();
    mockSetup.mockImplementation(setup);
    app = createApplication();
  });

  const makeRequest = () =>
    request(app)
      .post(ENDPOINT)
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntityId);

  describe('201 Response', () => {
    it.each([undefined, {}])(
      'creates English defaults for body %j',
      async (body) => {
        const req = makeRequest();
        const response = await (body === undefined ? req : req.send(body));
        expect(response.status).toBe(201);
        expect(response.type).toBe('application/json');
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
        expect(response.body).toEqual(
          Object.keys(headerAccountNameAliasesReqValidation.shape).map(
            (subType) =>
              expect.objectContaining({
                subType,
                accountingEntityId,
                createdBy: actor.id,
                balance: { amount: 0, currencyCode: 'NGN', isMinorUnit: true },
                functionalBalance: {
                  amount: 0,
                  currencyCode: 'NGN',
                  isMinorUnit: true,
                },
              })
          )
        );
        expect(response.body).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              subType: 'cash_and_cash_equivalent',
              name: 'Cash and Cash Equivalents',
            }),
            expect.objectContaining({
              subType: 'retained_earnings',
              name: 'Retained Earnings',
            }),
            expect.objectContaining({
              subType: 'opening_balance',
              name: 'Opening Balance Equity',
            }),
          ])
        );
        expect(mockSetup).toHaveBeenCalledWith(body);
        expect(
          mockLedgerAccountPersistenceService.create
        ).toHaveBeenCalledTimes(20);
        expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
      }
    );

    it('translates only supplied names and sanitizes them through the domain', async () => {
      const defaults = await makeRequest().send({});
      expect(defaults.status).toBe(201);
      const response = await makeRequest().send({
        receivables: '  Créances  ',
        retained_earnings: '利益剰余金',
      });
      expect(response.status).toBe(201);
      expect(
        (response.body as ILedgerAccountDto[]).map((account) => account.name)
      ).toEqual(
        (defaults.body as ILedgerAccountDto[]).map((account) =>
          account.subType === 'receivables'
            ? 'Créances'
            : account.subType === 'retained_earnings'
              ? '利益剰余金'
              : account.name
        )
      );
    });

    it('accepts all twenty translated aliases', async () => {
      const aliases = Object.fromEntries(
        Object.keys(headerAccountNameAliasesReqValidation.shape).map(
          (subType) => [subType, `Traduit ${subType}`]
        )
      );
      const response = await makeRequest().send(aliases);
      expect(response.status).toBe(201);
      expect(
        (response.body as ILedgerAccountDto[]).map((account) => account.name)
      ).toEqual(Object.values(aliases));
    });
  });

  describe('401 Response', () => {
    it('requires authentication before setup', async () => {
      const response = await request(app)
        .post(ENDPOINT)
        .set('x-accounting-entity-id', accountingEntityId)
        .send({});
      expect(response.status).toBe(401);
      expect(mockSetup).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('requires Alpha 1 access', async () => {
      mockFeatureFlagService.canAccessAlpha1.mockResolvedValueOnce(false);
      const response = await makeRequest().send({});
      expect(response.status).toBe(403);
      expect(mockSetup).not.toHaveBeenCalled();
    });

    it('rejects an entity owned by another user', async () => {
      mockAccountingEntityRepo.findByIdAndUserId.mockResolvedValueOnce({
        ...accountingEntity,
        ownerId: accountingEntityId,
      });
      const response = await makeRequest().send({});
      expect(response.status).toBe(403);
      expect(mockSetup).not.toHaveBeenCalled();
    });
  });

  describe('409 Response', () => {
    it.each([
      ['100000', 'ledger_error_header_account_already_exists_conflict'],
      [
        '301000',
        'ledger_error_asset_retained_earnings_account_already_exists_conflict',
      ],
      [
        '399000',
        'ledger_error_asset_opening_balance_account_already_exists_conflict',
      ],
    ])(
      'preserves the existing conflict for %s',
      async (existingCode, errorKey) => {
        mockLedgerAccountRepo.findByCode.mockImplementation(async (code) =>
          code === existingCode ? ({ code } as ILedgerAccount) : null
        );
        const response = await makeRequest().send({});
        expect(response.status).toBe(409);
        expect(response.body.errorKey).toBe(errorKey);
        expect(
          mockLedgerAccountPersistenceService.create
        ).not.toHaveBeenCalled();
        expect(mockEventBus.publish).not.toHaveBeenCalled();
      }
    );
  });

  describe('422 Response', () => {
    it.each([
      { code: '100000' },
      { aliases: { receivables: 'Créances' } },
      [],
      { receivables: null },
      { receivables: 42 },
    ])(
      'rejects invalid transport input %j before orchestration',
      async (body) => {
        const response = await makeRequest().send(body);
        expect(response.status).toBe(422);
        expect(response.body.errorKey).toBe('app_error_validation_error');
        expect(mockSetup).not.toHaveBeenCalled();
        expect(
          mockLedgerAccountPersistenceService.create
        ).not.toHaveBeenCalled();
      }
    );

    it.each(['', '  ', ' a ', 'x'.repeat(101)])(
      'rejects invalid alias length %j before preparation',
      async (name) => {
        const response = await makeRequest().send({ receivables: name });
        expect(response.status).toBe(422);
        expect(response.body.errorKey).toBe('app_error_validation_error');
        expect(mockLedgerAccountRepo.findByCode).not.toHaveBeenCalled();
        expect(
          mockLedgerAccountPersistenceService.create
        ).not.toHaveBeenCalled();
      }
    );
  });

  describe('500 Response', () => {
    it('preserves the existing missing active entity error path', async () => {
      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .send({});
      expect(response.status).toBe(500);
      expect(mockSetup).not.toHaveBeenCalled();
    });

    it('rejects raw JSON null at the existing strict JSON parser', async () => {
      const response = await makeRequest()
        .set('Content-Type', 'application/json')
        .send('null');
      expect(response.status).toBe(500);
      expect(mockSetup).not.toHaveBeenCalled();
      expect(mockLedgerAccountPersistenceService.create).not.toHaveBeenCalled();
    });

    it('sanitizes write failures without publishing events', async () => {
      mockLedgerAccountPersistenceService.create.mockRejectedValueOnce(
        new Error('database password leaked')
      );
      const response = await makeRequest().send({});
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        name: 'InternalServerError',
        errorKey: 'app_error_unexpected',
      });
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });
});
