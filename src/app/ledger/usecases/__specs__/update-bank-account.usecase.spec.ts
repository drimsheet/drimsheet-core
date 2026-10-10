import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import { IBankAccount } from '@domain/ledger/types/asset-account.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';
import actorEntity from '@domain/user/entities/actor.entity';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import mockJournalEntryPersistenceService from '@app/journal-entry/contracts/__mocks__/journal-entry-persistence.service.mock';
import mockOpeningBalanceEntryAppService from '@app/journal-entry/contracts/__mocks__/opening-balance-entry.service.mock';
import mockLedgerAccountBalanceEnrichmentService from '@app/ledger/contracts/__mocks__/ledger-account-balance-enrichment.service.mock';
import mockLedgerAccountBalanceAdjustmentQueue from '@app/ledger/contracts/__mocks__/ledger-balance-adjustment-queue.mock';
import { mockAssetAccountService } from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import {
  mockBankAccountRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import makeUpdateBankAccountUsecase from '@app/ledger/usecases/update-bank-account.usecase';
import mockOutboxService from '@app/outbox/contracts/__mocks__/outbox.service.mock';
import mockFxLotCostBasisService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-cost-basis-persistence.service.mock';
import { TFxLotAcquisitionAppResult } from '@app/subledger/fx-cost-basis/types/fx-lot.service.types';

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
  bankAccountRepo: mockBankAccountRepo,
  cashAccountService: mockAssetAccountService,
  openingBalanceEntryAppService: mockOpeningBalanceEntryAppService,
  journalEntryPersistenceService: mockJournalEntryPersistenceService,
  balanceEnrichmentService: mockLedgerAccountBalanceEnrichmentService,
  fxCostBasisPersistenceService: mockFxLotCostBasisService.persistence,
  outboxService: mockOutboxService,
  ledgerBalanceAdjustmentQueue: mockLedgerAccountBalanceAdjustmentQueue,
};

describe('update bank account workflow', () => {
  let account: IBankAccount;

  beforeEach(() => {
    jest.resetAllMocks();
    account = makeAccount();
    mockAppContext.get.mockReturnValue({
      actor,
      accountingEntity,
      correlationId,
    });
    mockRepoService.createTransaction.mockResolvedValue(mockRepoTransaction);
    mockRepoTransaction.handleError.mockImplementation(async (error) => {
      throw error;
    });
    mockLedgerAccountRepo.findById.mockResolvedValue(account);
    mockAssetAccountService.updateBankSubAccount.mockImplementation(
      async (current, changes) =>
        ledgerAccountEntity.update(current as IBankAccount, {
          name: changes.name,
          openingBalanceDate: changes.openingBalanceDate,
          meta: changes.bankDetails
            ? {
                countryCode: (current as IBankAccount).meta.countryCode,
                ...changes.bankDetails,
              }
            : (current as IBankAccount).meta,
        })
    );
    mockLedgerAccountBalanceEnrichmentService.enrich.mockImplementation(
      async ([updated]) => [
        { id: updated.id, name: updated.name } as ILedgerAccountDto,
      ]
    );
  });

  it('orchestrates the audited account and journal persistence in one transaction', async () => {
    const response = await makeUpdateBankAccountUsecase(deps)(account.id, {
      name: 'Branch cash',
    });

    expect(response).toMatchObject({ id: account.id, name: 'Branch cash' });
    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
      account.id,
      accountingEntity.id,
      { ...transactionOptions, lock: 'update' }
    );
    expect(
      mockOpeningBalanceEntryAppService.createOrRevise
    ).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Branch cash', version: 2 }),
      expect.objectContaining({
        ...transactionOptions,
        expectedVersion: 1,
        history: expect.anything(),
      })
    );
    expect(mockJournalEntryPersistenceService.rectify).not.toHaveBeenCalled();
    expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
    expect(mockRepoTransaction.dispose).not.toHaveBeenCalled();
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('does not persist account history when the requested details are unchanged', async () => {
    await makeUpdateBankAccountUsecase(deps)(account.id, {
      name: account.name,
    });

    expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
    expect(
      mockOpeningBalanceEntryAppService.createOrRevise
    ).not.toHaveBeenCalled();
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
      account,
      {
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

  it('persists an opening-balance mutation prepared by the entry service', async () => {
    const creation = journalEntryEntity.make({
      accountingEntityId: accountingEntity.id,
      sourceType: 'opening_balance',
      effectiveDate: openingBalanceDate,
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
    mockOpeningBalanceEntryAppService.createOrRevise.mockResolvedValueOnce({
      mutation: {
        entriesToCreate: [creation],
        entryUpdate: null,
        events: creation[1],
      },
      currentJournalEntry: creation[0],
      fxAcquisition: null,
      entriesForBalancePropagation: [],
    });

    await makeUpdateBankAccountUsecase(deps)(account.id, {
      name: 'Branch cash',
      openingBalance,
    });

    expect(
      mockOpeningBalanceEntryAppService.createOrRevise
    ).toHaveBeenCalledWith(
      { account, openingBalance, accountingEntity, actor: actor.id },
      transactionOptions
    );
    expect(mockJournalEntryPersistenceService.rectify).toHaveBeenCalledWith(
      expect.objectContaining({
        entriesToCreate: [expect.objectContaining({ entry: creation[0] })],
        entryUpdate: null,
      }),
      transactionOptions
    );
    expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
  });

  it('persists FX and balance propagation atomically before publishing and queueing', async () => {
    [account] = ledgerAccountEntity.make<IBankAccount>({
      ...account,
      status: 'active',
      currency: SYSTEM_CURRENCIES.USD,
    });
    mockLedgerAccountRepo.findById.mockResolvedValue(account);
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
    const records = {
      lot: { id: account.id },
      acquisition: { id: account.id },
      lotHistory: { entityId: account.id },
      acquisitionHistory: { entityId: account.id },
      missingOfficialRateOutbox: null,
    } as unknown as TFxLotAcquisitionAppResult['records'];
    const fxEvent = {
      type: 'fx_cost_basis_lot_created',
      data: { id: account.id },
      occurredAt: openingBalanceDate,
      enrichedAt: null,
    };
    mockOpeningBalanceEntryAppService.createOrRevise.mockResolvedValueOnce({
      mutation: {
        entriesToCreate: [creation],
        entryUpdate: null,
        events: creation[1],
      },
      currentJournalEntry: creation[0],
      fxAcquisition: { records, events: [fxEvent] },
      entriesForBalancePropagation: [creation[0]],
    });

    const response = await makeUpdateBankAccountUsecase(deps)(account.id, {
      openingBalance: foreignOpeningBalance,
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
      mockFxLotCostBasisService.persistence.persistAcquisition
    ).toHaveBeenCalledWith(records, transactionOptions);
    expect(mockOutboxService.createBalancePropagation).toHaveBeenCalledWith(
      creation[0].id,
      transactionOptions
    );
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).toHaveBeenCalledWith({
      journalEntryId: creation[0].id,
      correlationId,
    });
    expect(mockEventBus.publish).toHaveBeenCalledWith([
      ...[
        ...(
          await mockAssetAccountService.updateBankSubAccount.mock.results[0]
            .value
        )[1],
        ...creation[1],
        fxEvent,
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
      mockJournalEntryPersistenceService.rectify,
      mockFxLotCostBasisService.persistence.persistAcquisition,
      mockOutboxService.createBalancePropagation,
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
      mockLedgerAccountBalanceEnrichmentService.enrich
    ).not.toHaveBeenCalled();
  });

  it('delegates failures to the transaction without disposing it again', async () => {
    const failure = new Error('journal update failed');
    mockOpeningBalanceEntryAppService.createOrRevise.mockRejectedValueOnce(
      failure
    );

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
      mockLedgerAccountBalanceEnrichmentService.enrich
    ).not.toHaveBeenCalled();
  });

  it('validates the command before acquiring a transaction', async () => {
    await expect(
      makeUpdateBankAccountUsecase(deps)(account.id, {})
    ).rejects.toBeInstanceOf(appError.UnprocessableEntity);
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
  });
});
