import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';
import repoError from '@shared/values/errors/repo.error';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import ledgerAccountBalanceEntity from '@domain/ledger/entities/ledger-account-balance.entity';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ledgerAccountBalanceAdjustmentService from '@domain/ledger/services/ledger-account-balance-adjustment.service';
import makeLedgerAccountBalanceService from '@domain/ledger/services/ledger-account-balance.service';
import { IBankAccount } from '@domain/ledger/types/asset-account.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';
import actorEntity from '@domain/user/entities/actor.entity';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import mockJournalEntryPersistenceAppService from '@app/journal-entry/contracts/__mocks__/journal-entry-persistence.service.mock';
import { mockOpeningBalanceEntryService } from '@app/journal-entry/contracts/__mocks__/journal-entry.domain.services.mock';
import { mockJournalEntryRepo } from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';
import mockLedgerAccountBalanceEnrichmentAppService from '@app/ledger/contracts/__mocks__/ledger-account-balance-enrichment.service.mock';
import mockLedgerAccountBalanceAdjustmentQueue from '@app/ledger/contracts/__mocks__/ledger-balance-adjustment-queue.mock';
import {
  mockAssetAccountService,
  mockLedgerAccountBalanceService,
} from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import {
  mockBankAccountRepo,
  mockLedgerAccountBalanceRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import makeLedgerBalancePropagationPreparationAppService from '@app/ledger/services/ledger-balance-propagation-preparation.service';
import makeUpdateBankAccountUsecase from '@app/ledger/usecases/update-bank-account.usecase';
import mockExchangeRateAppService from '@app/money/contracts/__mocks__/exchange-rate.service.mock';
import mockOutboxAppService from '@app/outbox/contracts/__mocks__/outbox.service.mock';
import { mockFxCostBasisLotService } from '@app/subledger/contracts/__mocks__/subledger.domain.services.mock';
import { makeFxAcquisitionResult } from '@app/subledger/fx-cost-basis/__fixtures__/fx-lot-results.fixture';
import mockFxLotCostBasisAppService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-cost-basis-persistence.service.mock';

const [actor] = actorEntity.makeUser({
  email: 'bank-update@example.com',
  displayName: 'Petty Cash Updater',
});
const [accountingEntity] = accountingEntityEntity.make({
  name: 'Business',
  type: 'private_company',
  ownerId: actor.id,
  createdBy: actor.id,
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
});
const correlationId = 'bank-update';
const transactionOptions = {
  correlationId,
  tx: mockRepoTransaction.context,
};
const openingBalanceDate = new Date('2026-03-01T00:00:00.000Z');
const openingBalance = {
  amount: { amount: 25_000, currencyCode: 'NGN', isMinorUnit: true },
  exchangeRate: null,
  date: openingBalanceDate,
};

function makeAccount() {
  return ledgerAccountEntity.make<IBankAccount>({
    name: 'Office cash',
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
  })[0];
}

const deps = {
  appContext: mockAppContext,
  eventBus: mockEventBus,
  repoService: mockRepoService,
  ledgerAccountRepo: mockLedgerAccountRepo,
  ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
  ledgerAccountBalanceService: mockLedgerAccountBalanceService,
  bankAccountRepo: mockBankAccountRepo,
  cashAccountService: mockAssetAccountService,
  journalEntryRepo: mockJournalEntryRepo,
  openingBalanceEntryService: mockOpeningBalanceEntryService,
  fxCostBasisLotService: mockFxCostBasisLotService,
  exchangeRateAppService: mockExchangeRateAppService,
  journalEntryPersistenceAppService: mockJournalEntryPersistenceAppService,
  balanceEnrichmentAppService: mockLedgerAccountBalanceEnrichmentAppService,
  fxCostBasisPersistenceAppService: mockFxLotCostBasisAppService.persistence,
  outboxAppService: mockOutboxAppService,
  ledgerBalanceAdjustmentQueue: mockLedgerAccountBalanceAdjustmentQueue,
};

describe('update bank account workflow', () => {
  let account: IBankAccount;

  beforeEach(() => {
    jest.resetAllMocks();
    mockExchangeRateAppService.getOfficialRate.mockResolvedValue(null);
    mockJournalEntryRepo.existsPostedByAccountId.mockResolvedValue(false);
    mockJournalEntryRepo.findDraftOpeningBalanceByAccountId.mockResolvedValue(
      null
    );
    account = makeAccount();
    mockLedgerAccountBalanceService.updateBalance.mockImplementation(
      makeLedgerAccountBalanceService().updateBalance
    );
    mockLedgerAccountBalanceRepo.findByAccountId.mockImplementation(async () =>
      ledgerAccountBalanceEntity.make({
        createdBy: account.createdBy,
        ledgerAccountId: account.id,
        accountingEntityId: account.accountingEntityId,
        accountMaterializedPath: account.materializedPath,
        currencyCode: 'NGN',
        functionalCurrencyCode: 'NGN',
      })
    );
    mockAppContext.get.mockReturnValue({
      actor,
      accountingEntity,
      correlationId,
    });
    mockRepoService.createTransaction.mockResolvedValue(mockRepoTransaction);
    mockRepoTransaction.handleError.mockImplementation(async (error) => {
      throw error;
    });
    mockAssetAccountService.updateBankSubAccount.mockImplementation(
      async (changes) =>
        ledgerAccountEntity.update(account, {
          name: changes.name,
          currency: changes.currency,
          openingBalanceDate: changes.openingBalanceDate,
          meta: changes.bankDetails
            ? {
                countryCode: account.meta.countryCode,
                ...changes.bankDetails,
              }
            : account.meta,
        })
    );
    mockLedgerAccountBalanceEnrichmentAppService.enrich.mockImplementation(
      async ([updated]) => [
        { id: updated.id, name: updated.name } as ILedgerAccountDto,
      ]
    );
  });

  it('passes currency edits to the domain and persists the audited account', async () => {
    await makeUpdateBankAccountUsecase(deps)(account.id, {
      currencyCode: 'USD',
    });
    expect(mockAssetAccountService.updateBankSubAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        id: account.id,
        accountingEntityId: accountingEntity.id,
        currency: SYSTEM_CURRENCIES.USD,
      }),
      transactionOptions
    );
    expect(mockLedgerAccountRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ currency: SYSTEM_CURRENCIES.USD }),
      expect.objectContaining({
        ...transactionOptions,
        expectedVersion: account.version,
      })
    );
    expect(mockLedgerAccountRepo.findByCode).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
  });

  it('updates the zero balance currency in the account transaction without an adjustment', async () => {
    await makeUpdateBankAccountUsecase(deps)(account.id, {
      currencyCode: 'USD',
    });

    expect(mockLedgerAccountBalanceRepo.findByAccountId).toHaveBeenCalledWith(
      account.id,
      accountingEntity.id,
      transactionOptions
    );
    expect(mockLedgerAccountBalanceRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        ledgerAccountId: account.id,
        amount: { amount: 0n, currency: SYSTEM_CURRENCIES.USD },
        functionalAmount: { amount: 0n, currency: SYSTEM_CURRENCIES.NGN },
        version: 2,
      }),
      { ...transactionOptions, expectedVersion: 1 }
    );
    expect(mockLedgerAccountBalanceService.updateBalance).toHaveBeenCalledWith({
      existingAccount: account,
      updatedAccount: expect.objectContaining({
        id: account.id,
        currency: SYSTEM_CURRENCIES.USD,
      }),
      existingBalance: expect.objectContaining({
        ledgerAccountId: account.id,
        amount: { amount: 0n, currency: SYSTEM_CURRENCIES.NGN },
      }),
    });
    expect(mockLedgerAccountBalanceRepo.adjustBalance).not.toHaveBeenCalled();
    expect(
      mockLedgerAccountBalanceRepo.update.mock.invocationCallOrder[0]
    ).toBeLessThan(mockRepoTransaction.commit.mock.invocationCallOrder[0]);
  });

  it('rolls back a currency change when its balance is missing', async () => {
    mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValueOnce(null);
    await expect(
      makeUpdateBankAccountUsecase(deps)(account.id, { currencyCode: 'USD' })
    ).rejects.toBeInstanceOf(ledgerAppError.BalanceNotFound);
    expect(mockRepoTransaction.handleError).toHaveBeenCalled();
    expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
    expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('rolls back the account update when the balance version conflicts', async () => {
    const failure = new repoError.VersionNotFound();
    mockLedgerAccountBalanceRepo.update.mockRejectedValueOnce(failure);
    await expect(
      makeUpdateBankAccountUsecase(deps)(account.id, { currencyCode: 'USD' })
    ).rejects.toBe(failure);
    expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
    expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
  });

  it('does not rewrite a balance already denominated in the requested currency', async () => {
    mockLedgerAccountBalanceRepo.findByAccountId.mockResolvedValueOnce(
      ledgerAccountBalanceEntity.make({
        createdBy: actor.id,
        ledgerAccountId: account.id,
        accountingEntityId: accountingEntity.id,
        accountMaterializedPath: account.materializedPath,
        currencyCode: 'USD',
        functionalCurrencyCode: 'NGN',
      })
    );
    await makeUpdateBankAccountUsecase(deps)(account.id, {
      currencyCode: 'USD',
    });
    expect(mockLedgerAccountBalanceRepo.update).not.toHaveBeenCalled();
    expect(mockRepoTransaction.commit).toHaveBeenCalled();
  });

  it('does not persist an account audit for an unchanged currency', async () => {
    await makeUpdateBankAccountUsecase(deps)(account.id, {
      currencyCode: 'NGN',
    });
    expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceRepo.findByAccountId).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceRepo.update).not.toHaveBeenCalled();
  });

  it('orchestrates the audited account and journal persistence in one transaction', async () => {
    const response = await makeUpdateBankAccountUsecase(deps)(account.id, {
      name: 'Branch cash',
    });

    expect(response).toMatchObject({ id: account.id, name: 'Branch cash' });
    expect(mockAssetAccountService.updateBankSubAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        id: account.id,
        accountingEntityId: accountingEntity.id,
        name: 'Branch cash',
      }),
      transactionOptions
    );
    expect(mockOpeningBalanceEntryService.create).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Branch cash', version: 2 }),
      expect.objectContaining({
        ...transactionOptions,
        expectedVersion: 1,
        history: expect.anything(),
      })
    );
    expect(
      mockJournalEntryPersistenceAppService.rectify
    ).not.toHaveBeenCalled();
    expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
    expect(mockRepoTransaction.dispose).not.toHaveBeenCalled();
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('does not persist account history when the requested details are unchanged', async () => {
    await makeUpdateBankAccountUsecase(deps)(account.id, {
      name: account.name,
    });

    expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
    expect(mockOpeningBalanceEntryService.create).not.toHaveBeenCalled();
    expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
  });

  it('persists bank metadata and details in the same account transaction', async () => {
    const bankAccount = {
      bankName: 'Other Bank',
      accountName: 'Main account',
      accountNumber: '9876543210',
    };
    await makeUpdateBankAccountUsecase(deps)(account.id, { bankAccount });
    expect(mockAssetAccountService.updateBankSubAccount).toHaveBeenCalledWith(
      {
        id: account.id,
        accountingEntityId: accountingEntity.id,
        bankDetails: bankAccount,
        name: undefined,
        openingBalanceDate: undefined,
      },
      transactionOptions
    );
    expect(mockLedgerAccountRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: { ...bankAccount, countryCode: 'NG' },
        version: account.version + 1,
      }),
      expect.objectContaining({
        ...transactionOptions,
        expectedVersion: account.version,
      })
    );
    expect(mockBankAccountRepo.update).toHaveBeenCalledWith(
      account.id,
      accountingEntity.id,
      { ...bankAccount, countryCode: 'NG' },
      transactionOptions
    );
    expect(mockBankAccountRepo.update.mock.invocationCallOrder[0]).toBeLessThan(
      mockRepoTransaction.commit.mock.invocationCallOrder[0]
    );
  });

  it('skips both writes for identical bank details', async () => {
    await makeUpdateBankAccountUsecase(deps)(account.id, {
      bankAccount: {
        bankName: account.meta.bankName,
        accountName: account.meta.accountName,
        accountNumber: account.meta.accountNumber,
      },
    });
    expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
    expect(mockBankAccountRepo.update).not.toHaveBeenCalled();
  });

  it('delegates bank persistence failures for rollback without committing or publishing', async () => {
    const failure = new Error('bank update failed');
    mockBankAccountRepo.update.mockRejectedValue(failure);
    await expect(
      makeUpdateBankAccountUsecase(deps)(account.id, {
        bankAccount: {
          bankName: 'Other Bank',
          accountName: 'Main account',
          accountNumber: '9876543210',
        },
      })
    ).rejects.toBe(failure);
    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
    expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it.each(['create', 'update', 'unchanged'] as const)(
    'handles an opening-balance draft %s',
    async (operation) => {
      const creation = journalEntryEntity.make({
        accountingEntityId: accountingEntity.id,
        sourceType: 'opening_balance',
        effectiveDate:
          operation === 'update'
            ? new Date('2026-02-28T00:00:00.000Z')
            : openingBalanceDate,
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
            description: 'Opening balance',
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
      const [draft] = creation;
      const revised = journalEntryEntity.update(
        draft,
        {
          id: draft.id,
          effectiveDate: openingBalanceDate,
          lines: draft.lines.map((line) =>
            line.sequenceOrder === 1
              ? { ...line, description: 'Corrected opening balance' }
              : line
          ),
        },
        actor.id
      );
      if (operation === 'create') {
        mockOpeningBalanceEntryService.createDraft.mockResolvedValueOnce(
          creation
        );
      } else {
        mockJournalEntryRepo.findDraftOpeningBalanceByAccountId.mockResolvedValueOnce(
          draft
        );
        mockOpeningBalanceEntryService.updateDraft.mockResolvedValueOnce(
          operation === 'update' ? revised : [draft, [], null]
        );
      }

      await makeUpdateBankAccountUsecase(deps)(account.id, {
        name: 'Branch cash',
        openingBalance,
      });

      const expectedPayload = {
        accountingEntityId: accountingEntity.id,
        functionalCurrencyCode: accountingEntity.functionalCurrencyCode,
        account: expect.objectContaining({
          id: account.id,
          openingBalanceDate: openingBalance.date,
        }),
        amount: { amount: 25_000n, currency: SYSTEM_CURRENCIES.NGN },
        exchangeRate: null,
        effectiveDate: openingBalance.date,
        createdBy: actor.id,
      };
      if (operation === 'create') {
        expect(mockOpeningBalanceEntryService.createDraft).toHaveBeenCalledWith(
          expectedPayload,
          transactionOptions
        );
      } else {
        expect(mockOpeningBalanceEntryService.updateDraft).toHaveBeenCalledWith(
          { ...expectedPayload, entry: draft },
          transactionOptions
        );
      }
      expect(mockFxCostBasisLotService.acquire).not.toHaveBeenCalled();
      if (operation === 'unchanged') {
        expect(
          mockJournalEntryPersistenceAppService.rectify
        ).not.toHaveBeenCalled();
      } else {
        const persistence =
          operation === 'create'
            ? {
                entriesToCreate: [expect.objectContaining({ entry: draft })],
                entryUpdate: null,
              }
            : {
                entriesToCreate: [],
                entryUpdate: expect.objectContaining({
                  entry: revised[0],
                  expectedVersion: draft.version,
                  linesToUpdate: [revised[0].lines[0]],
                }),
              };
        expect(
          mockJournalEntryPersistenceAppService.rectify
        ).toHaveBeenCalledWith(persistence, transactionOptions);
      }
      expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
    }
  );

  it('persists FX and balance propagation atomically before publishing and queueing', async () => {
    [account] = ledgerAccountEntity.make<IBankAccount>({
      ...account,
      status: 'active',
      currency: SYSTEM_CURRENCIES.NGN,
    });
    const exchangeRate = exchangeRateValue.make({
      baseCurrencyCode: 'USD',
      targetCurrencyCode: 'NGN',
      rate: 1_500,
      type: 'official',
      asOf: openingBalanceDate,
      source: 'Test',
    });
    const foreignOpeningBalance = {
      ...openingBalance,
      amount: { ...openingBalance.amount, currencyCode: 'USD' },
      exchangeRate,
    };
    const creation = journalEntryEntity.make({
      accountingEntityId: accountingEntity.id,
      sourceType: 'opening_balance',
      effectiveDate: openingBalanceDate,
      postedAt: openingBalanceDate,
      memo: 'Opening balance',
      createdBy: actor.id,
      functionalCurrency: SYSTEM_CURRENCIES.NGN,
      lines: [
        {
          accountId: account.id,
          sequenceOrder: 1,
          amount: { amount: 25_000n, currency: SYSTEM_CURRENCIES.USD },
          exchangeRate,
          side: 'debit',
          description: 'Opening balance',
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
        {
          accountId: 'd4444444-4444-4444-8444-444444444444' as TEntityId,
          sequenceOrder: 2,
          amount: { amount: 37_500_000n, currency: SYSTEM_CURRENCIES.NGN },
          exchangeRate: null,
          side: 'credit',
          description: null,
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
      ],
    });
    const fxAcquisition = makeFxAcquisitionResult();
    const [, lotEvents] = fxAcquisition.lot;
    const [, acquisitionEvents] = fxAcquisition.acquisition;
    mockOpeningBalanceEntryService.create.mockResolvedValueOnce(creation);

    mockFxCostBasisLotService.acquire.mockReturnValueOnce(fxAcquisition);

    const response = await makeUpdateBankAccountUsecase(deps)(account.id, {
      currencyCode: 'USD',
      openingBalance: foreignOpeningBalance,
    });

    expect(mockOpeningBalanceEntryService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        account: expect.objectContaining({
          currency: SYSTEM_CURRENCIES.USD,
          openingBalanceDate,
        }),
      }),
      transactionOptions
    );
    expect(mockFxCostBasisLotService.acquire).toHaveBeenCalledWith({
      journalEntry: creation[0],
      account: expect.objectContaining({
        currency: SYSTEM_CURRENCIES.USD,
        openingBalanceDate,
      }),
      createdBy: actor.id,
      officialRate: null,
    });
    expect(response).toMatchObject({
      id: account.id,
      name: account.name,
      balance: foreignOpeningBalance.amount,
      functionalBalance: {
        amount: 37_500_000,
        currencyCode: 'NGN',
        isMinorUnit: true,
      },
    });
    expect(
      mockFxLotCostBasisAppService.persistence.persistAcquisition
    ).toHaveBeenCalledWith(fxAcquisition, actor.id, transactionOptions);
    expect(mockOutboxAppService.createBalancePropagation).toHaveBeenCalledWith(
      creation[0].id,
      transactionOptions
    );
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).toHaveBeenCalledWith(
      correlationId,
      {
        journalEntryId: creation[0].id,
      }
    );
    expect(mockEventBus.publish).toHaveBeenCalledWith([
      ...[
        ...(
          await mockAssetAccountService.updateBankSubAccount.mock.results[0]
            .value
        )[1],
        ...creation[1],
        ...lotEvents,
        ...acquisitionEvents,
      ].map((event) => ({
        ...event,
        correlationId,
        idempotencyKey: undefined,
        enrichedAt: expect.any(Date),
      })),
    ]);
    const commitOrder = mockRepoTransaction.commit.mock.invocationCallOrder[0];
    for (const write of [
      mockLedgerAccountRepo.update,
      mockLedgerAccountBalanceRepo.update,
      mockJournalEntryPersistenceAppService.rectify,
      mockFxLotCostBasisAppService.persistence.persistAcquisition,
      mockOutboxAppService.createBalancePropagation,
    ]) {
      expect(write).toHaveBeenCalledTimes(1);
      expect(write.mock.invocationCallOrder[0]).toBeLessThan(commitOrder);
    }
    expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish.mock.invocationCallOrder[0]).toBeGreaterThan(
      commitOrder
    );
    expect(
      mockLedgerAccountBalanceAdjustmentQueue.add.mock.invocationCallOrder[0]
    ).toBeGreaterThan(commitOrder);
    expect(
      mockLedgerAccountBalanceEnrichmentAppService.enrich
    ).not.toHaveBeenCalled();

    // Run the queued journal through the real propagation preparation using the saved balance.
    const [savedBalance] = mockLedgerAccountBalanceRepo.update.mock.calls[0];
    const [savedAccount] = mockLedgerAccountRepo.update.mock.calls[0];
    const parent: ILedgerAccount = {
      ...savedAccount,
      id: savedAccount.controlAccountId!,
      materializedPath: '100000',
      currency: null,
      isControlAccount: true,
    };
    const equity: ILedgerAccount = {
      ...savedAccount,
      id: creation[0].lines[1].accountId,
      materializedPath: '300000',
      type: 'equity',
      subType: 'opening_balance',
    };
    const parentBalance = ledgerAccountBalanceEntity.make({
      createdBy: actor.id,
      ledgerAccountId: parent.id,
      accountingEntityId: accountingEntity.id,
      accountMaterializedPath: parent.materializedPath,
      currencyCode: 'NGN',
      functionalCurrencyCode: 'NGN',
    });
    mockJournalEntryRepo.findById.mockResolvedValueOnce(creation[0]);
    mockLedgerAccountRepo.findAllByIds.mockResolvedValueOnce([
      savedAccount,
      equity,
    ]);
    mockLedgerAccountRepo.findAllByMaterializedPath.mockResolvedValueOnce([
      parent,
      savedAccount,
      equity,
    ]);
    mockLedgerAccountBalanceRepo.findAllByAccountIds.mockResolvedValueOnce([
      savedBalance,
      parentBalance,
    ]);
    const propagation = makeLedgerBalancePropagationPreparationAppService({
      journalEntryRepo: mockJournalEntryRepo,
      ledgerAccountRepo: mockLedgerAccountRepo,
      ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
      ledgerAccountBalanceAdjustmentService,
    });
    const adjustments = await propagation.prepare(creation[0].id, {
      correlationId,
    });
    expect(adjustments).toHaveLength(2);
    expect(
      adjustments.find(
        (item) =>
          item.balanceAdjustment.newBalance.ledgerAccountId === account.id
      )
    ).toMatchObject({
      expectedVersion: 2,
      balanceAdjustment: {
        newBalance: {
          amount: { amount: 25_000n, currency: SYSTEM_CURRENCIES.USD },
          functionalAmount: {
            amount: 37_500_000n,
            currency: SYSTEM_CURRENCIES.NGN,
          },
        },
      },
    });
    expect(
      adjustments.find(
        (item) =>
          item.balanceAdjustment.newBalance.ledgerAccountId === parent.id
      )
    ).toMatchObject({
      expectedVersion: 1,
      balanceAdjustment: {
        newBalance: {
          amount: { amount: 37_500_000n, currency: SYSTEM_CURRENCIES.NGN },
        },
      },
    });
  });

  it('locks opening-balance edits after any posting', async () => {
    mockJournalEntryRepo.existsPostedByAccountId.mockResolvedValueOnce(true);

    await expect(
      makeUpdateBankAccountUsecase(deps)(account.id, { openingBalance })
    ).rejects.toBeInstanceOf(ledgerAccountError.OpeningBalanceLocked);

    expect(
      mockJournalEntryRepo.findDraftOpeningBalanceByAccountId
    ).not.toHaveBeenCalled();
    expect(
      mockJournalEntryPersistenceAppService.rectify
    ).not.toHaveBeenCalled();
    expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
  });

  it('delegates failures to the transaction without disposing it again', async () => {
    const failure = new Error('journal update failed');
    mockOpeningBalanceEntryService.createDraft.mockRejectedValueOnce(failure);

    await expect(
      makeUpdateBankAccountUsecase(deps)(account.id, {
        name: 'Branch cash',
        openingBalance,
      })
    ).rejects.toBe(failure);

    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
    expect(mockRepoTransaction.dispose).not.toHaveBeenCalled();
    expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
  });

  it('does not return or publish when the transaction fails to commit', async () => {
    const failure = new Error('commit failed');
    mockRepoTransaction.commit.mockRejectedValueOnce(failure);

    await expect(
      makeUpdateBankAccountUsecase(deps)(account.id, {
        name: 'Branch cash',
      })
    ).rejects.toBe(failure);

    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    expect(
      mockLedgerAccountBalanceEnrichmentAppService.enrich
    ).not.toHaveBeenCalled();
  });

  it('validates the command before acquiring a transaction', async () => {
    await expect(
      makeUpdateBankAccountUsecase(deps)(account.id, {})
    ).rejects.toBeInstanceOf(appError.UnprocessableEntity);
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
  });
});
