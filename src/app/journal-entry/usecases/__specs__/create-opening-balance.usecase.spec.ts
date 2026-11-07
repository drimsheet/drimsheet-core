import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import { TEntityId } from '@shared/types/uuid';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import periodError from '@domain/accounting/errors/period.error';
import { EAccountingEntityType } from '@domain/accounting/types/accounting-entity.types';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import makeCashAccountService from '@domain/ledger/services/asset-account/cash-account.service';
import makeEquityAccountService from '@domain/ledger/services/equity-account/equity-account.service';
import { ICashAndCashEquivalentAccount } from '@domain/ledger/types/asset-account.types';
import { IOpeningBalanceEquityAccount } from '@domain/ledger/types/equity-account.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import { EExchangeRateType } from '@domain/money/types/exchange-rate.types';
import actorEntity from '@domain/user/entities/actor.entity';
import { IUser } from '@domain/user/types/user.types';

import mockAppContext, {
  mockClientSession,
} from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/types/app-context.types';
import mockJournalEntryPersistenceAppService from '@app/journal-entry/contracts/__mocks__/journal-entry-persistence.service.mock';
import { mockOpeningBalanceEntryService } from '@app/journal-entry/contracts/__mocks__/journal-entry.domain.services.mock';
import makeCreateOpeningBalanceUseCase from '@app/journal-entry/usecases/create-opening-balance.usecase';
import mockLedgerAccountBalanceAdjustmentQueue from '@app/ledger/contracts/__mocks__/ledger-balance-adjustment-queue.mock';
import { mockLedgerAccountService } from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import {
  mockBankAccountRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import mockOutboxAppService from '@app/outbox/contracts/__mocks__/outbox.service.mock';
import mockFxLotCostBasisAppService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-cost-basis-persistence.service.mock';
import mockFxLotAppService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-lot.service.mock';
import { TFxLotAcquisitionAppResult } from '@app/subledger/fx-cost-basis/types/fx-lot.service.types';

const actor = {
  ...actorEntity.makeUser({
    email: 'actor@example.com',
    displayName: 'Actor',
  })[0],
  id: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
};

describe('createOpeningBalanceUseCase', () => {
  const correlationId = 'test-corr-id';

  const mockUser: IUser = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: '123e4567-e89b-12d3-a456-426614174001' as TEntityId,
    version: 1,
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const [mockAccountingEntity] = accountingEntityEntity.make({
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    name: 'Test Accounting Entity',
    ownerId: mockUser.id,
    type: EAccountingEntityType.Individual,
    functionalCurrencyCode: 'NGN',
    jurisdictionCode: 'NG',
  });

  const cashAccountService = makeCashAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
    bankAccountRepo: mockBankAccountRepo,
    ledgerAccountService: mockLedgerAccountService,
  });
  const equityAccountService = makeEquityAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
  });
  let mockAssetAccount: ICashAndCashEquivalentAccount;
  let mockEquityAccount: IOpeningBalanceEquityAccount;
  let mockJournalCreation: ReturnType<typeof journalEntryEntity.make>;

  beforeAll(async () => {
    const [controlAccount] = await cashAccountService.createHeader(
      {
        name: 'Cash and Cash Equivalents',
        accountingEntity: mockAccountingEntity,
        createdBy: mockUser.id,
      },
      { correlationId }
    );
    [mockAssetAccount] = ((
      payload: Omit<
        Parameters<typeof cashAccountService.createPettyCashSubAccount>[0],
        'controlAccountId'
      > & { controlAccount: ILedgerAccount }
    ) => {
      const controlAccount = payload.controlAccount;
      const code = String(Number(controlAccount.code) + 1).padStart(6, '0');
      const materializedPath = controlAccount.materializedPath + '.' + code;
      return ledgerAccountEntity.make<ILedgerAccount>({
        name: payload.name,
        accountingEntityId: payload.accountingEntity.id,
        code,
        materializedPath,
        normalBalance: 'debit',
        type: 'asset',
        subType: 'cash_and_cash_equivalent',
        behavior: 'petty_cash',
        isControlAccount: payload.isControlAccount,
        controlAccountId: controlAccount.id,
        currency: payload.currency,
        meta: null,
        status: 'active',
        contraAccountRule: 'contra_permitted',
        adjunctAccountRule: 'adjunct_permitted',
        createdBy: payload.createdBy,
      }) as Awaited<
        ReturnType<typeof cashAccountService.createPettyCashSubAccount>
      >;
    })({
      name: 'Cash',
      currency: SYSTEM_CURRENCIES.NGN,
      isControlAccount: false,
      controlAccount,
      accountingEntity: mockAccountingEntity,
      createdBy: mockUser.id,
    });
    [mockEquityAccount] =
      await equityAccountService.createOpeningBalanceAccount(
        {
          name: 'Opening Balance Equity',
          accountingEntity: mockAccountingEntity,
          createdBy: mockUser.id,
        },
        { correlationId }
      );
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepoService.createTransaction
      .mockReset()
      .mockResolvedValue(mockRepoTransaction);
    mockRepoTransaction.commit.mockReset().mockResolvedValue();
    mockRepoTransaction.handleError
      .mockReset()
      .mockImplementation(async (error) => {
        throw error;
      });
    mockOutboxAppService.createBalancePropagation
      .mockReset()
      .mockResolvedValue();
    mockLedgerAccountBalanceAdjustmentQueue.add.mockReset().mockResolvedValue();

    mockAppContext.get.mockReturnValue({
      actor,
      correlationId,
      clientSession: mockClientSession,
      accountingEntity: mockAccountingEntity,
    } as unknown as IAppContextData);

    mockLedgerAccountRepo.findById.mockResolvedValueOnce(mockAssetAccount);

    mockJournalCreation = journalEntryEntity.make({
      accountingEntityId: mockAccountingEntity.id,
      sourceType: EJournalEntrySourceType.OpeningBalance,
      effectiveDate: new Date('2026-04-24T00:00:00.000Z'),
      postedAt: new Date('2026-04-24T00:00:00.000Z'),
      memo: 'Opening balance',
      createdBy: mockUser.id,
      functionalCurrency: SYSTEM_CURRENCIES.NGN,
      lines: [
        {
          accountId: mockAssetAccount.id,
          sequenceOrder: 1,
          amount: { amount: 1000n, currency: SYSTEM_CURRENCIES.NGN },
          exchangeRate: null,
          side: EJournalSide.Debit,
          description: 'Opening balance',
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
        {
          accountId: mockEquityAccount.id,
          sequenceOrder: 2,
          amount: { amount: 1000n, currency: SYSTEM_CURRENCIES.NGN },
          exchangeRate: null,
          side: EJournalSide.Credit,
          description: 'Opening balance',
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
      ],
    });
    mockOpeningBalanceEntryService.create
      .mockReset()
      .mockResolvedValue(mockJournalCreation);
    mockFxLotAppService.acquire.mockReset().mockResolvedValue(null);
  });

  const getUseCase = () =>
    makeCreateOpeningBalanceUseCase({
      appContext: mockAppContext,
      ledgerAccountRepo: mockLedgerAccountRepo,
      eventBus: mockEventBus,
      openingBalanceEntryService: mockOpeningBalanceEntryService,
      fxLotAppService: mockFxLotAppService,
      journalEntryPersistenceAppService: mockJournalEntryPersistenceAppService,
      outboxAppService: mockOutboxAppService,
      ledgerBalanceAdjustmentQueue: mockLedgerAccountBalanceAdjustmentQueue,
      repoService: mockRepoService,
      fxCostBasisPersistenceAppService:
        mockFxLotCostBasisAppService.persistence,
    });

  it.each([
    new journalEntryError.ArchivedLedgerAccountNotAllowed(),
    new periodError.PostingDateNotCovered(),
    new periodError.PostingPeriodAmbiguous(),
    new periodError.PostingPeriodNotOpen(),
  ])(
    'does not persist or publish when journal creation rejects: %s',
    async (failure) => {
      mockOpeningBalanceEntryService.create.mockRejectedValueOnce(failure);
      await expect(
        getUseCase()({
          accountId: mockAssetAccount.id,
          amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
          exchangeRate: null,
          date: new Date('2026-04-24T00:00:00Z'),
        })
      ).rejects.toBe(failure);
      expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
      expect(
        mockJournalEntryPersistenceAppService.create
      ).not.toHaveBeenCalled();
      expect(
        mockOutboxAppService.createBalancePropagation
      ).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );

  it('should successfully record opening balance and update account openingBalanceDate', async () => {
    const fxRecords = {
      missingOfficialRateOutbox: null,
    } as unknown as TFxLotAcquisitionAppResult['records'];
    mockFxLotAppService.acquire.mockResolvedValueOnce({
      records: fxRecords,
      events: [],
    });
    const useCase = getUseCase();

    const payload = {
      accountId: mockAssetAccount.id,
      amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
      exchangeRate: null,
      date: new Date('2026-04-24T00:00:00.000Z'),
    };

    await useCase(payload);

    expect(mockOpeningBalanceEntryService.create).toHaveBeenCalledWith(
      {
        accountingEntityId: mockAccountingEntity.id,
        functionalCurrencyCode: mockAccountingEntity.functionalCurrencyCode,
        account: mockAssetAccount,
        amount: { amount: 1000n, currency: SYSTEM_CURRENCIES.NGN },
        exchangeRate: null,
        effectiveDate: payload.date,
        createdBy: mockUser.actorId,
      },
      { correlationId }
    );

    expect(mockFxLotAppService.acquire).toHaveBeenCalledWith(
      {
        journalEntry: mockJournalCreation[0],
        account: mockAssetAccount,
        actor: mockUser.actorId,
      },
      { correlationId }
    );

    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
      mockAssetAccount.id,
      mockAccountingEntity.id,
      { correlationId }
    );
    expect(mockRepoService.createTransaction).toHaveBeenCalled();
    expect(mockLedgerAccountRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: mockAssetAccount.id,
        openingBalanceDate: payload.date,
      }),
      expect.objectContaining({
        correlationId,
      })
    );
    expect(mockJournalEntryPersistenceAppService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        accountingEntityId: mockAccountingEntity.id,
      }),
      expect.objectContaining({
        correlationId,
      }),
      expect.arrayContaining([
        expect.objectContaining({
          correlationId,
        }),
      ]),
      expect.objectContaining({ correlationId })
    );
    expect(
      mockFxLotCostBasisAppService.persistence.persistAcquisition
    ).toHaveBeenCalledWith(
      fxRecords,
      expect.objectContaining({ correlationId, tx: expect.anything() })
    );
    const persistedJournalEntry =
      mockJournalEntryPersistenceAppService.create.mock.calls[0][0];
    expect(mockOutboxAppService.createBalancePropagation).toHaveBeenCalledWith(
      persistedJournalEntry.id,
      expect.objectContaining({ correlationId, tx: expect.anything() })
    );
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).toHaveBeenCalledWith(
      correlationId,
      {
        journalEntryId: persistedJournalEntry.id,
      }
    );
    expect(mockRepoTransaction.commit.mock.invocationCallOrder[0]).toBeLessThan(
      mockLedgerAccountBalanceAdjustmentQueue.add.mock.invocationCallOrder[0]
    );
    expect(mockEventBus.publish).toHaveBeenCalled();
  });

  it('persists the journal without account history when its opening date is already set', async () => {
    const date = new Date('2026-04-24T00:00:00.000Z');
    const [accountWithOpeningDate] =
      ledgerAccountEntity.updateOpeningBalanceDate(mockAssetAccount, date);
    mockLedgerAccountRepo.findById
      .mockReset()
      .mockResolvedValue(accountWithOpeningDate);

    await getUseCase()({
      accountId: accountWithOpeningDate.id,
      amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
      exchangeRate: null,
      date: new Date(date),
    });

    expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
    expect(mockJournalEntryPersistenceAppService.create).toHaveBeenCalledWith(
      mockJournalCreation[0],
      expect.objectContaining({
        entityId: mockJournalCreation[0].id,
        correlationId,
      }),
      expect.any(Array),
      { correlationId, tx: mockRepoTransaction.context }
    );
    expect(mockOutboxAppService.createBalancePropagation).toHaveBeenCalledWith(
      mockJournalCreation[0].id,
      { correlationId, tx: mockRepoTransaction.context }
    );
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).toHaveBeenCalledWith(
      correlationId,
      {
        journalEntryId: mockJournalCreation[0].id,
      }
    );
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      mockJournalCreation[1].map((event) =>
        expect.objectContaining({
          type: event.type,
          data: event.data,
          correlationId,
        })
      )
    );
  });

  it('should record opening balance with an exchange rate', async () => {
    const useCase = getUseCase();

    mockLedgerAccountRepo.findById
      .mockReset()
      .mockResolvedValueOnce(mockAssetAccount);

    const payload = {
      accountId: mockAssetAccount.id,
      amount: { amount: 1000, currencyCode: 'USD', isMinorUnit: true },
      exchangeRate: {
        baseCurrencyCode: 'USD',
        targetCurrencyCode: 'NGN',
        rate: 1500,
        type: EExchangeRateType.Official,
        asOf: new Date('2026-04-24T00:00:00.000Z'),
        source: 'test',
      },
      date: new Date('2026-04-24T00:00:00.000Z'),
    };

    await useCase(payload);

    expect(mockJournalEntryPersistenceAppService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        accountingEntityId: mockAccountingEntity.id,
      }),
      expect.objectContaining({
        correlationId,
      }),
      expect.any(Array),
      expect.objectContaining({ correlationId })
    );
  });

  it('persists a non-posted opening-balance journal without queueing balance work', async () => {
    const [journalEntry, journalEvents, audit] = journalEntryEntity.make({
      accountingEntityId: mockAccountingEntity.id,
      sourceType: EJournalEntrySourceType.OpeningBalance,
      effectiveDate: new Date('2026-04-24T00:00:00.000Z'),
      postedAt: null,
      memo: 'Opening balance',
      createdBy: mockUser.id,
      functionalCurrency: SYSTEM_CURRENCIES.NGN,
      lines: [
        {
          accountId: mockAssetAccount.id,
          sequenceOrder: 1,
          amount: { amount: 1000n, currency: SYSTEM_CURRENCIES.NGN },
          exchangeRate: null,
          side: EJournalSide.Debit,
          description: 'Opening balance',
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
        {
          accountId: mockEquityAccount.id,
          sequenceOrder: 2,
          amount: { amount: 1000n, currency: SYSTEM_CURRENCIES.NGN },
          exchangeRate: null,
          side: EJournalSide.Credit,
          description: 'Opening balance',
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
      ],
    });
    const draftCreation = [
      { ...journalEntry, status: EJournalEntryStatus.Draft },
      journalEvents,
      audit,
    ] as ReturnType<typeof journalEntryEntity.make>;
    mockOpeningBalanceEntryService.create.mockResolvedValueOnce(draftCreation);

    await getUseCase()({
      accountId: mockAssetAccount.id,
      amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
      exchangeRate: null,
      date: new Date('2026-04-24T00:00:00.000Z'),
    });

    expect(mockFxLotAppService.acquire).not.toHaveBeenCalled();
    expect(mockJournalEntryPersistenceAppService.create).toHaveBeenCalled();
    expect(
      mockOutboxAppService.createBalancePropagation
    ).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
    expect(mockEventBus.publish).toHaveBeenCalled();
  });

  it('should not persist or publish events when opening balance entry creation fails', async () => {
    const useCase = getUseCase();

    mockOpeningBalanceEntryService.create.mockRejectedValueOnce(
      new Error('Entry creation failed')
    );

    const payload = {
      accountId: mockAssetAccount.id,
      amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
      exchangeRate: null,
      date: new Date('2026-04-24T00:00:00.000Z'),
    };

    await expect(useCase(payload)).rejects.toThrow('Entry creation failed');

    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
    expect(mockJournalEntryPersistenceAppService.create).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('should throw ErrorResourceNotFound if the account is not found', async () => {
    const useCase = getUseCase();

    mockLedgerAccountRepo.findById.mockReset().mockResolvedValue(null);

    const payload = {
      accountId: mockAssetAccount.id,
      amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
      exchangeRate: null,
      date: new Date('2026-04-24T00:00:00.000Z'),
    };

    await expect(useCase(payload)).rejects.toThrow(
      ledgerAppError.AccountNotFound
    );
  });

  it.each(['acquisition', 'persistence', 'outbox', 'commit'] as const)(
    'handles transaction %s failure without publishing or enqueueing',
    async (phase) => {
      const failure = new Error('transaction failed');
      const failures = {
        acquisition: mockRepoService.createTransaction,
        persistence: mockJournalEntryPersistenceAppService.create,
        outbox: mockOutboxAppService.createBalancePropagation,
        commit: mockRepoTransaction.commit,
      };
      failures[phase].mockRejectedValueOnce(failure);

      await expect(
        getUseCase()({
          accountId: mockAssetAccount.id,
          amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
          date: new Date('2026-04-24T00:00:00.000Z'),
          exchangeRate: null,
        })
      ).rejects.toBe(failure);

      expect(mockEventBus.publish).not.toHaveBeenCalled();
      expect(
        mockLedgerAccountBalanceAdjustmentQueue.add
      ).not.toHaveBeenCalled();
      if (phase === 'acquisition') {
        expect(mockRepoTransaction.handleError).not.toHaveBeenCalled();
        expect(
          mockJournalEntryPersistenceAppService.create
        ).not.toHaveBeenCalled();
      } else {
        expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
      }
      if (phase !== 'commit') {
        expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
      }
    }
  );

  afterEach(() => {
    if (mockLedgerAccountBalanceAdjustmentQueue.add.mock.calls.length === 0) {
      return;
    }

    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
    expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
    const outboxCalls =
      mockOutboxAppService.createBalancePropagation.mock.invocationCallOrder;
    expect(outboxCalls[outboxCalls.length - 1]).toBeLessThan(
      mockRepoTransaction.commit.mock.invocationCallOrder[0]
    );
    expect(mockRepoTransaction.commit.mock.invocationCallOrder[0]).toBeLessThan(
      mockEventBus.publish.mock.invocationCallOrder[0]
    );
    expect(mockEventBus.publish.mock.invocationCallOrder[0]).toBeLessThan(
      mockLedgerAccountBalanceAdjustmentQueue.add.mock.invocationCallOrder[0]
    );
  });
});
