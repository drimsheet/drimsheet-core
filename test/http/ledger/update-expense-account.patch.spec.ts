import { Express } from 'express';
import request from 'supertest';

import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import { TEntityId } from '@shared/types/uuid';
import repoError from '@shared/values/errors/repo.error';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import makeExpenseAccountService from '@domain/ledger/services/expense-account/expense-account.service';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import actorEntity from '@domain/user/entities/actor.entity';
import { IUser } from '@domain/user/types/user.types';

import { mockAccountingEntityRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag.service.mock';
import mockBalanceEnrichmentAppService from '@app/ledger/contracts/__mocks__/ledger-account-balance-enrichment.service.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import ledgerAccountToDtoMapperHelper from '@app/ledger/usecases/helpers/ledger-account-to-dto-mapper.helper';
import makeUpdateExpenseAccountUsecase from '@app/ledger/usecases/update-expense-account.usecase';
import { mockActorService } from '@app/user/contracts/__mocks__/actor.services.mock';
import { mockUserRepo } from '@app/user/contracts/__mocks__/user.repos.mock';

import { tokenAppService } from '@infra/ioc/services/auth';
import * as ledgerUseCases from '@infra/ioc/usecases/ledger';
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
  tokenAppService: { getAuthUser: jest.fn() },
}));
jest.mock('@infra/ioc/usecases/ledger', () => ({
  updateExpenseAccountUseCase: jest.fn(),
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

const ENDPOINT = '/api/v1/ledger/expense';
const [actor] = actorEntity.makeUser({
  email: 'expense-update@example.com',
  displayName: 'Account owner',
});
const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const [accountingEntity] = accountingEntityEntity.make({
  name: 'Business',
  type: 'individual',
  ownerId: userId,
  createdBy: actor.id,
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
});
const [account] = ledgerAccountEntity.make<ILedgerAccount>({
  name: 'Operating account',
  code: '502042',
  materializedPath: '502000.502042',
  accountingEntityId: accountingEntity.id,
  createdBy: actor.id,
  type: 'expense',
  subType: 'rent_and_utilities',
  behavior: 'rent_and_utilities',
  normalBalance: 'debit',
  isControlAccount: false,
  controlAccountId: 'c3333333-3333-4333-8333-333333333333' as TEntityId,
  currency: null,
  status: 'draft',
  contraAccountRule: 'contra_not_permitted',
  adjunctAccountRule: 'adjunct_not_permitted',
  meta: null,
});
describe('PATCH /ledger/expense/{accountId}', () => {
  let app: Express;
  const update = jest.mocked(ledgerUseCases.updateExpenseAccountUseCase);
  beforeEach(() => {
    jest.resetAllMocks();
    mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(true);
    jest.mocked(tokenAppService.getAuthUser).mockResolvedValue({ id: userId });
    mockActorService.resolveUser.mockResolvedValue(actor);
    mockUserRepo.findById.mockResolvedValue({
      id: userId,
      actorId: actor.id,
      createdBy: actor.id,
    } as IUser);
    mockAccountingEntityRepo.findByIdAndUserId.mockResolvedValue(
      accountingEntity
    );
    mockLedgerAccountRepo.findById.mockResolvedValue(account);
    mockBalanceEnrichmentAppService.enrich.mockImplementation(
      async (accounts) =>
        accounts.map((current) =>
          ledgerAccountToDtoMapperHelper(current, null, 'NGN')
        )
    );
    update.mockImplementation(
      makeUpdateExpenseAccountUsecase({
        appContext,
        eventBus: mockEventBus,
        ledgerAccountRepo: mockLedgerAccountRepo,
        expenseAccountService: makeExpenseAccountService(),
        balanceEnrichmentAppService: mockBalanceEnrichmentAppService,
      })
    );
    app = createApplication();
  });
  const patch = (payload: object, id: string = account.id) =>
    request(app)
      .patch(`${ENDPOINT}/${id}`)
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntity.id)
      .send(payload);

  describe('200 Response', () => {
    it.each(['active', 'draft'] as const)(
      'updates the name of an %s account with trusted audit attribution',
      async (status) => {
        mockLedgerAccountRepo.findById.mockResolvedValue({
          ...account,
          status,
        });
        const response = await patch({ name: 'Updated account' }).set(
          'x-actor-id',
          'forged'
        );
        expect(response.status).toBe(200);
        expect(response.type).toBe('application/json');
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.body).toMatchObject({
          id: account.id,
          name: 'Updated account',
          status,
          behavior: 'rent_and_utilities',
          openingBalanceDate: null,
        });
        expect(response.body).not.toHaveProperty('version');
        expect(update).toHaveBeenCalledWith(account.id, {
          name: 'Updated account',
        });
        expect(mockLedgerAccountRepo.update).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Updated account',
            meta: account.meta,
          }),
          expect.objectContaining({
            expectedVersion: account.version,
            history: expect.objectContaining({ actorId: actor.id }),
          })
        );
      }
    );
  });
  describe('400 Response', () => {
    it('rejects malformed IDs before reading accounts', async () => {
      expect((await patch({ name: 'Changed' }, 'invalid')).status).toBe(400);
      expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
    });
    it.each([{ status: 'archived' as const }, { type: 'asset' as const }])(
      'rejects an ineligible account: %j',
      async (changes) => {
        mockLedgerAccountRepo.findById.mockResolvedValue({
          ...account,
          ...changes,
        });
        expect((await patch({ name: 'Changed' })).status).toBe(400);
        expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
      }
    );
  });
  describe('401 Response', () => {
    it('rejects unauthenticated callers before orchestration', async () => {
      expect(
        (
          await request(app)
            .patch(`${ENDPOINT}/${account.id}`)
            .send({ name: 'Changed' })
        ).status
      ).toBe(401);
      expect(update).not.toHaveBeenCalled();
    });
  });
  describe('403 Response', () => {
    it('enforces Alpha 1 access', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(false);
      expect((await patch({ name: 'Changed' })).status).toBe(403);
      expect(update).not.toHaveBeenCalled();
    });
    it('enforces accounting entity ownership', async () => {
      mockAccountingEntityRepo.findByIdAndUserId.mockResolvedValue({
        ...accountingEntity,
        ownerId: account.id,
      });
      expect((await patch({ name: 'Changed' })).status).toBe(403);
      expect(update).not.toHaveBeenCalled();
    });
  });
  describe('404 Response', () => {
    it('scopes the account lookup to the active entity and rejects absent accounts', async () => {
      mockLedgerAccountRepo.findById.mockResolvedValue(null);
      const response = await patch({ name: 'Changed' });
      expect(response.status).toBe(404);
      expect(response.body.errorKey).toBe('app_error_ledger_account_not_found');
      expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
        account.id,
        accountingEntity.id,
        expect.objectContaining({ correlationId: expect.any(String) })
      );
      expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
    });
  });
  describe('409 Response', () => {
    it('propagates a version conflict without publishing events', async () => {
      mockLedgerAccountRepo.update.mockRejectedValue(
        new repoError.VersionNotFound()
      );
      expect((await patch({ name: 'Changed' })).status).toBe(409);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });
  describe('422 Response', () => {
    it.each([
      {},
      { name: '' },
      { name: 'x'.repeat(101) },
      { openingBalance: null },
      { name: 'Changed', status: 'active' },
      { name: 'Changed', currencyCode: 'USD' },
      { name: 'Changed', bankAccount: { accountNumber: '0123456789' } },
      { name: 'Changed', expectedVersion: 1 },
      { name: 'Changed', behavior: 'bank_charge' },
      { name: 'Changed', controlAccountId: actor.id },
    ])('rejects invalid update %j before persistence', async (payload) => {
      const response = await patch(payload);
      expect(response.status).toBe(422);
      expect(response.body.errorKey).toBe('app_error_validation_error');
      expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
    });
  });
  describe('500 Response', () => {
    it('sanitizes persistence failures', async () => {
      mockLedgerAccountRepo.update.mockRejectedValue(
        new Error('private database details')
      );
      const response = await patch({ name: 'Changed' });
      expect(response.status).toBe(500);
      expect(response.body.errorKey).toBe('app_error_unexpected');
      expect(JSON.stringify(response.body)).not.toContain(
        'private database details'
      );
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });
});
