import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import { ITransactionContext } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
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
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import mockJournalEntryPersistenceService from '@app/journal-entry/contracts/__mocks__/journal-entry-persistence.service.mock';
import mockOpeningBalanceEntryAppService from '@app/journal-entry/contracts/__mocks__/opening-balance-entry.service.mock';
import makeCreateOpeningBalanceUseCase from '@app/journal-entry/usecases/create-opening-balance.usecase';
import mockLedgerAccountBalanceAdjustmentQueue from '@app/ledger/contracts/__mocks__/ledger-balance-adjustment-queue.mock';
import { mockLedgerCodeAllocationService } from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import {
  mockBankAccountRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import mockOutboxService from '@app/outbox/contracts/__mocks__/outbox.service.mock';
import mockFxLotCostBasisService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-cost-basis-persistence.service.mock';
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
    ledgerCodeAllocationService: mockLedgerCodeAllocationService,
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
    mockRepoService.runInTransaction
      .mockReset()
      .mockImplementation(async (transactionFn) =>
        transactionFn('mock-tx' as unknown as ITransactionContext)
      );
    mockOutboxService.createBalancePropagation.mockReset().mockResolvedValue();
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
    mockOpeningBalanceEntryAppService.create.mockResolvedValue({
      creation: mockJournalCreation,
      fxAcquisition: null,
      entriesForBalancePropagation: [mockJournalCreation[0]],
    });
  });

  const getUseCase = () =>
    makeCreateOpeningBalanceUseCase({
      appContext: mockAppContext,
      ledgerAccountRepo: mockLedgerAccountRepo,
      eventBus: mockEventBus,
      openingBalanceEntryAppService: mockOpeningBalanceEntryAppService,
      journalEntryPersistenceService: mockJournalEntryPersistenceService,
      outboxService: mockOutboxService,
      ledgerBalanceAdjustmentQueue: mockLedgerAccountBalanceAdjustmentQueue,
      repoService: mockRepoService,
      fxCostBasisPersistenceService: mockFxLotCostBasisService.persistence,
    });

  it('does not persist when opening journal creation rejects an archived account', async () => {
    const failure = new journalEntryError.ArchivedLedgerAccountNotAllowed();
    mockOpeningBalanceEntryAppService.create.mockRejectedValueOnce(failure);
    await expect(
      getUseCase()({
        accountId: mockAssetAccount.id,
        amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
        exchangeRate: null,
        date: new Date('2026-04-24T00:00:00Z'),
      })
    ).rejects.toBe(failure);
    expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
    expect(mockJournalEntryPersistenceService.create).not.toHaveBeenCalled();
    expect(mockOutboxService.createBalancePropagation).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('should successfully record opening balance and update account openingBalanceDate', async () => {
    const fxRecords = {
      missingOfficialRateOutbox: null,
    } as unknown as TFxLotAcquisitionAppResult['records'];
    mockOpeningBalanceEntryAppService.create.mockResolvedValueOnce({
      creation: mockJournalCreation,
      fxAcquisition: { records: fxRecords, events: [] },
      entriesForBalancePropagation: [mockJournalCreation[0]],
    });
    const useCase = getUseCase();

    const payload = {
      accountId: mockAssetAccount.id,
      amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
      exchangeRate: null,
      date: new Date('2026-04-24T00:00:00.000Z'),
    };

    await useCase(payload);

    expect(mockOpeningBalanceEntryAppService.create).toHaveBeenCalledWith(
      {
        account: mockAssetAccount,
        openingBalance: {
          amount: payload.amount,
          exchangeRate: payload.exchangeRate,
          date: payload.date,
        },
        accountingEntity: mockAccountingEntity,
        actor: mockUser.actorId,
      },
      { correlationId }
    );

    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
      mockAssetAccount.id,
      mockAccountingEntity.id,
      { correlationId }
    );
    expect(mockRepoService.runInTransaction).toHaveBeenCalled();
    expect(mockLedgerAccountRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: mockAssetAccount.id,
        openingBalanceDate: payload.date,
      }),
      expect.objectContaining({
        correlationId,
      })
    );
    expect(mockJournalEntryPersistenceService.create).toHaveBeenCalledWith(
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
      mockFxLotCostBasisService.persistence.persistAcquisition
    ).toHaveBeenCalledWith(
      fxRecords,
      expect.objectContaining({ correlationId, tx: expect.anything() })
    );
    const persistedJournalEntry =
      mockJournalEntryPersistenceService.create.mock.calls[0][0];
    expect(mockOutboxService.createBalancePropagation).toHaveBeenCalledWith(
      persistedJournalEntry.id,
      expect.objectContaining({ correlationId, tx: expect.anything() })
    );
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).toHaveBeenCalledWith({
      journalEntryId: persistedJournalEntry.id,
      correlationId,
    });
    expect(
      mockRepoService.runInTransaction.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mockLedgerAccountBalanceAdjustmentQueue.add.mock.invocationCallOrder[0]
    );
    expect(mockEventBus.publish).toHaveBeenCalled();
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

    expect(mockJournalEntryPersistenceService.create).toHaveBeenCalledWith(
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
    mockOpeningBalanceEntryAppService.create.mockResolvedValueOnce({
      creation: draftCreation,
      fxAcquisition: null,
      entriesForBalancePropagation: [],
    });

    await getUseCase()({
      accountId: mockAssetAccount.id,
      amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
      exchangeRate: null,
      date: new Date('2026-04-24T00:00:00.000Z'),
    });

    expect(mockJournalEntryPersistenceService.create).toHaveBeenCalled();
    expect(mockOutboxService.createBalancePropagation).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
    expect(mockEventBus.publish).toHaveBeenCalled();
  });

  it('should not persist or publish events when opening balance entry creation fails', async () => {
    const useCase = getUseCase();

    mockOpeningBalanceEntryAppService.create.mockRejectedValueOnce(
      new Error('Entry creation failed')
    );

    const payload = {
      accountId: mockAssetAccount.id,
      amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
      exchangeRate: null,
      date: new Date('2026-04-24T00:00:00.000Z'),
    };

    await expect(useCase(payload)).rejects.toThrow('Entry creation failed');

    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.update).not.toHaveBeenCalled();
    expect(mockJournalEntryPersistenceService.create).not.toHaveBeenCalled();
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
});
