import { Express } from 'express';
import request from 'supertest';

import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import { TEntityId } from '@shared/types/uuid';
import repoError from '@shared/values/errors/repo.error';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import makeCashAccountService from '@domain/ledger/services/asset-account/cash-account.service';
import { IBankAccount } from '@domain/ledger/types/asset-account.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import actorEntity from '@domain/user/entities/actor.entity';
import { IUser } from '@domain/user/types/user.types';

import { mockAccountingEntityRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag.service.mock';
import mockJournalEntryPersistenceAppService from '@app/journal-entry/contracts/__mocks__/journal-entry-persistence.service.mock';
import mockOpeningBalanceEntryAppService from '@app/journal-entry/contracts/__mocks__/opening-balance-entry.service.mock';
import mockBalanceEnrichmentAppService from '@app/ledger/contracts/__mocks__/ledger-account-balance-enrichment.service.mock';
import mockBalanceQueue from '@app/ledger/contracts/__mocks__/ledger-balance-adjustment-queue.mock';
import { mockLedgerCodeAllocationService } from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import {
  mockBankAccountRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import ledgerAccountToDtoMapperHelper from '@app/ledger/usecases/helpers/ledger-account-to-dto-mapper.helper';
import makeUpdateBankAccountUsecase from '@app/ledger/usecases/update-bank-account.usecase';
import mockOutboxAppService from '@app/outbox/contracts/__mocks__/outbox.service.mock';
import mockFxCostBasisService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-cost-basis-persistence.service.mock';
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
  updateBankAccountUseCase: jest.fn(),
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

const ENDPOINT = '/api/v1/ledger/asset/bank';
const [actor] = actorEntity.makeUser({
  email: 'cash-update@example.com',
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
const [account] = ledgerAccountEntity.make<IBankAccount>({
  name: 'Operating account',
  code: '100042',
  materializedPath: '100000.100042',
  accountingEntityId: accountingEntity.id,
  createdBy: actor.id,
  type: 'asset',
  subType: 'cash_and_cash_equivalent',
  behavior: 'bank',
  normalBalance: 'debit',
  isControlAccount: false,
  controlAccountId: 'c3333333-3333-4333-8333-333333333333' as TEntityId,
  currency: SYSTEM_CURRENCIES.NGN,
  status: 'draft',
  contraAccountRule: 'contra_permitted',
  adjunctAccountRule: 'adjunct_permitted',
  meta: {
    countryCode: 'NG',
    bankName: 'Test Bank',
    accountName: 'Operating Account',
    accountNumber: '0123456789',
  },
});
const openingBalance = {
  amount: { amount: 25_000, currencyCode: 'NGN', isMinorUnit: true },
  exchangeRate: null,
  date: new Date('2026-03-01T00:00:00.000Z'),
};

describe('PATCH /ledger/asset/bank/{accountId}', () => {
  let app: Express;
  const update = jest.mocked(ledgerUseCases.updateBankAccountUseCase);
  const cashAccountService = makeCashAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
    bankAccountRepo: mockBankAccountRepo,
    ledgerCodeAllocationService: mockLedgerCodeAllocationService,
  });
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
    mockRepoService.createTransaction.mockResolvedValue(mockRepoTransaction);
    mockRepoTransaction.handleError.mockImplementation(async (error) => {
      throw error;
    });
    mockLedgerAccountRepo.findById.mockResolvedValue(account);
    mockBalanceEnrichmentAppService.enrich.mockImplementation(
      async (accounts) =>
        accounts.map((current) =>
          ledgerAccountToDtoMapperHelper(current, null, 'NGN')
        )
    );
    update.mockImplementation(
      makeUpdateBankAccountUsecase({
        appContext,
        eventBus: mockEventBus,
        repoService: mockRepoService,
        ledgerAccountRepo: mockLedgerAccountRepo,
        bankAccountRepo: mockBankAccountRepo,
        cashAccountService,
        openingBalanceEntryAppService: mockOpeningBalanceEntryAppService,
        journalEntryPersistenceAppService:
          mockJournalEntryPersistenceAppService,
        balanceEnrichmentAppService: mockBalanceEnrichmentAppService,
        fxCostBasisPersistenceAppService: mockFxCostBasisService.persistence,
        outboxAppService: mockOutboxAppService,
        ledgerBalanceAdjustmentQueue: mockBalanceQueue,
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
    it('accepts bank-details-only edits and normalizes both persisted records', async () => {
      const bankAccount = {
        bankName: ' Other Bank ',
        accountName: ' New owner ',
        accountNumber: ' 9876543210 ',
      };
      mockBankAccountRepo.findOne.mockResolvedValue(null);
      const response = await patch({ bankAccount });
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: account.id,
        name: account.name,
      });
      const normalizedDetails = {
        bankName: 'Other Bank',
        accountName: 'New owner',
        accountNumber: '9876543210',
        countryCode: 'NG',
      };
      expect(mockBankAccountRepo.update).toHaveBeenCalledWith(
        account.id,
        accountingEntity.id,
        normalizedDetails,
        expect.objectContaining({ tx: mockRepoTransaction.context })
      );
      expect(mockLedgerAccountRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ meta: normalizedDetails }),
        expect.objectContaining({ tx: mockRepoTransaction.context })
      );
    });

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
          behavior: 'bank',
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
        expect(
          mockOpeningBalanceEntryAppService.createOrRevise
        ).not.toHaveBeenCalled();
      }
    );
    it.each([false, true])(
      'coerces an opening-balance date and supports a combined name update: %s',
      async (includeName) => {
        const creation = journalEntryEntity.make({
          accountingEntityId: accountingEntity.id,
          sourceType: 'opening_balance',
          effectiveDate: openingBalance.date,
          postedAt: null,
          memo: 'Opening balance',
          createdBy: actor.id,
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
          lines: [
            {
              accountId: account.id,
              sequenceOrder: 1,
              amount: { amount: 25_000n, currency: SYSTEM_CURRENCIES.NGN },
              exchangeRate: null,
              side: 'debit',
              description: null,
              functionalCurrency: SYSTEM_CURRENCIES.NGN,
            },
            {
              accountId: 'd4444444-4444-4444-8444-444444444444' as TEntityId,
              sequenceOrder: 2,
              amount: { amount: 25_000n, currency: SYSTEM_CURRENCIES.NGN },
              exchangeRate: null,
              side: 'credit',
              description: null,
              functionalCurrency: SYSTEM_CURRENCIES.NGN,
            },
          ],
        });
        mockOpeningBalanceEntryAppService.createOrRevise.mockResolvedValue({
          mutation: {
            entriesToCreate: [creation],
            entryUpdate: null,
            events: creation[1],
          },
          currentJournalEntry: creation[0],
          fxAcquisition: null,
          entriesForBalancePropagation: [],
        });
        const response = await patch({
          openingBalance,
          ...(includeName
            ? {
                name: 'Updated account',
                bankAccount: {
                  bankName: 'Other Bank',
                  accountName: 'Owner',
                  accountNumber: '9876543210',
                },
              }
            : {}),
        });
        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          id: account.id,
          name: includeName ? 'Updated account' : account.name,
          openingBalanceDate: openingBalance.date.toISOString(),
        });
        expect(
          mockOpeningBalanceEntryAppService.createOrRevise
        ).toHaveBeenCalledWith(
          { account, openingBalance, accountingEntity, actor: actor.id },
          expect.objectContaining({ tx: mockRepoTransaction.context })
        );
        expect(
          mockJournalEntryPersistenceAppService.rectify
        ).toHaveBeenCalledTimes(1);
      }
    );
  });
  describe('400 Response', () => {
    it('rejects malformed IDs before opening a transaction', async () => {
      expect((await patch({ name: 'Changed' }, 'invalid')).status).toBe(400);
      expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    });
    it.each([
      { status: 'archived' as const },
      { behavior: 'petty_cash' as const },
    ])('rejects an ineligible account: %j', async (changes) => {
      mockLedgerAccountRepo.findById.mockResolvedValue({
        ...account,
        ...changes,
      });
      expect((await patch({ name: 'Changed' })).status).toBe(400);
      expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
    });
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
        expect.objectContaining({ lock: 'update' })
      );
      expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
    });
  });
  describe('409 Response', () => {
    it('rejects duplicate bank identities without persisting any requested changes', async () => {
      mockBankAccountRepo.findOne.mockResolvedValue(account.meta);
      const response = await patch({
        name: 'Changed',
        bankAccount: {
          bankName: 'Other Bank',
          accountName: 'Owner',
          accountNumber: '9876543210',
        },
      });
      expect(response.status).toBe(409);
      expect(response.body.errorKey).toBe(
        'ledger_error_asset_account_duplicate_bank_account_conflict'
      );
      expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
      expect(mockBankAccountRepo.update).not.toHaveBeenCalled();
    });

    it('propagates a version conflict without publishing events', async () => {
      mockLedgerAccountRepo.update.mockRejectedValue(
        new repoError.VersionNotFound()
      );
      expect((await patch({ name: 'Changed' })).status).toBe(409);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
      expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
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
      { bankAccount: null },
      {
        bankAccount: {
          bankName: 'Other Bank',
          accountName: 'Owner',
          accountNumber: '9876543210',
          countryCode: 'US',
        },
      },
      { name: 'Changed', expectedVersion: 1 },
      { openingBalance: { ...openingBalance, date: 'invalid' } },
      {
        openingBalance: {
          ...openingBalance,
          amount: { amount: 100, isMinorUnit: true },
        },
      },
    ])('rejects invalid update %j before persistence', async (payload) => {
      const response = await patch(payload);
      expect(response.status).toBe(422);
      expect(response.body.errorKey).toBe('app_error_validation_error');
      expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
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
