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
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import makeActivateExpenseAccountUsecase from '@app/ledger/usecases/activate-expense-account.usecase';
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
  activateExpenseAccountUseCase: jest.fn(),
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
  email: 'expense-activate@example.com',
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
describe('POST /ledger/expense/{accountId}/activate', () => {
  let app: Express;
  const activate = jest.mocked(ledgerUseCases.activateExpenseAccountUseCase);
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
    mockLedgerAccountRepo.findById.mockImplementation(async (id) => {
      if (id === account.id) return account;
      return {
        ...account,
        id: account.controlAccountId!,
        status: 'active',
        isControlAccount: true,
      };
    });
    activate.mockImplementation(
      makeActivateExpenseAccountUsecase({
        appContext,
        eventBus: mockEventBus,
        ledgerAccountRepo: mockLedgerAccountRepo,
        expenseAccountService: makeExpenseAccountService({
          ledgerAccountRepo: mockLedgerAccountRepo,
        }),
      })
    );
    app = createApplication();
  });
  const post = (id: string = account.id) =>
    request(app)
      .post(`${ENDPOINT}/${id}/activate`)
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntity.id);

  describe('204 Response', () => {
    it('activates a draft with trusted audit attribution and no response body', async () => {
      const response = await post().set('x-actor-id', 'forged');
      expect(response.status).toBe(204);
      expect(response.text).toBe('');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(activate).toHaveBeenCalledWith(account.id);
      expect(mockLedgerAccountRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: account.id,
          status: 'active',
          name: account.name,
          version: account.version + 1,
        }),
        expect.objectContaining({
          expectedVersion: account.version,
          history: expect.objectContaining({ actorId: actor.id }),
        })
      );
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    });
  });
  describe('400 Response', () => {
    it('rejects malformed IDs before reading accounts', async () => {
      expect((await post('invalid')).status).toBe(400);
      expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
    });
    it.each([
      { status: 'archived' as const },
      { status: 'active' as const },
      { type: 'asset' as const },
    ])('rejects an ineligible account: %j', async (changes) => {
      mockLedgerAccountRepo.findById.mockResolvedValueOnce({
        ...account,
        ...changes,
      });
      expect((await post()).status).toBe(400);
      expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
    });
  });
  describe('401 Response', () => {
    it('rejects unauthenticated callers before orchestration', async () => {
      expect(
        (await request(app).post(`${ENDPOINT}/${account.id}/activate`)).status
      ).toBe(401);
      expect(activate).not.toHaveBeenCalled();
    });
  });
  describe('403 Response', () => {
    it('enforces Alpha 1 access', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(false);
      expect((await post()).status).toBe(403);
      expect(activate).not.toHaveBeenCalled();
    });
    it('enforces accounting entity ownership', async () => {
      mockAccountingEntityRepo.findByIdAndUserId.mockResolvedValue({
        ...accountingEntity,
        ownerId: account.id,
      });
      expect((await post()).status).toBe(403);
      expect(activate).not.toHaveBeenCalled();
    });
  });
  describe('404 Response', () => {
    it('scopes the account lookup to the active entity and rejects absent accounts', async () => {
      mockLedgerAccountRepo.findById.mockResolvedValue(null);
      const response = await post();
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
      expect((await post()).status).toBe(409);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });
  describe('500 Response', () => {
    it('sanitizes persistence failures', async () => {
      mockLedgerAccountRepo.update.mockRejectedValue(
        new Error('private database details')
      );
      const response = await post();
      expect(response.status).toBe(500);
      expect(response.body.errorKey).toBe('app_error_unexpected');
      expect(JSON.stringify(response.body)).not.toContain(
        'private database details'
      );
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });
});
