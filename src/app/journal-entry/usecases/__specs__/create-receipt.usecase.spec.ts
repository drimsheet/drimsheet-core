import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import periodError from '@domain/accounting/errors/period.error';
import { EAccountingEntityType } from '@domain/accounting/types/accounting-entity.types';
import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import makeCounterpartyService from '@domain/counterparty/services/counterparty.service';
import { ECounterpartyType } from '@domain/counterparty/types/counterparty.types';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import makeCashAccountService from '@domain/ledger/services/asset-account/cash-account.service';
import makeServicesAccountService from '@domain/ledger/services/revenue-account/services.service';
import { ICashAndCashEquivalentAccount } from '@domain/ledger/types/asset-account.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { IServicesAccount } from '@domain/ledger/types/revenue-account.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import actorEntity from '@domain/user/entities/actor.entity';
import { IUser } from '@domain/user/types/user.types';

import mockAppContext, {
  mockClientSession,
} from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/types/app-context.types';
import { mockCounterpartyRepo } from '@app/counterparty/contracts/__mocks__/counterparty.repos.mock';
import mockFileManagementAppService from '@app/file/contracts/__mocks__/file-management.service.mock';
import fileAppError from '@app/file/errors/file.error';
import { EFileUploadPurpose } from '@app/file/types/file.types';
import mockJournalEntryPersistenceAppService from '@app/journal-entry/contracts/__mocks__/journal-entry-persistence.service.mock';
import { mockJournalEntryService } from '@app/journal-entry/contracts/__mocks__/journal-entry.domain.services.mock';
import { mockJournalLineRepo } from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';
import journalEntryDtoMapper from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.mapper';
import makeCreateReceiptUsecase from '@app/journal-entry/usecases/create-receipt.usecase';
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

describe('makeCreateReceiptUsecase', () => {
  const correlationId = 'test-correlation-id';
  const idempotencyKey = 'test-idempotency-key';

  const user: IUser = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    actorId: 'b2222222-2222-4222-8222-222222222222' as TEntityId,
    id: generateUUID(),
    version: 1,
    email: 'user@example.com',
    emailVerified: true,
    firstName: 'Test',
    lastName: 'User',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const [accountingEntity] = accountingEntityEntity.make({
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    name: 'Test Entity',
    ownerId: user.id,
    type: EAccountingEntityType.Individual,
    functionalCurrencyCode: 'NGN',
    jurisdictionCode: 'NG',
  });

  const cashAccountService = makeCashAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
    bankAccountRepo: mockBankAccountRepo,
    ledgerAccountService: mockLedgerAccountService,
  });
  const servicesAccountService = makeServicesAccountService({
    ledgerAccountRepo: mockLedgerAccountRepo,
    ledgerAccountService: mockLedgerAccountService,
  });
  let sourceAccount: IServicesAccount;
  let destinationAccount: ICashAndCashEquivalentAccount;

  const counterpartyService = makeCounterpartyService({
    journalLineRepo: mockJournalLineRepo,
  });
  const selectedCounterparty = counterpartyService.create({
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    accountingEntityId: accountingEntity.id,
    name: 'Jane Doe',
    type: ECounterpartyType.Individual,
  });

  const existingCounterparty = counterpartyService.create({
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    accountingEntityId: accountingEntity.id,
    name: 'Jane Doe',
    type: ECounterpartyType.Individual,
  });

  type TJournalEntryResult = ReturnType<typeof journalEntryEntity.make>;
  let journalEntry: TJournalEntryResult[0];
  let journalEntryEvents: TJournalEntryResult[1];
  let journalEntryAudit: TJournalEntryResult[2];

  beforeAll(async () => {
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(null);
    const [servicesHeader] = await servicesAccountService.createHeader(
      {
        name: 'Services',
        accountingEntity,
        createdBy: actor.id,
      },
      { correlationId }
    );
    [sourceAccount] = ((
      payload: Omit<
        Parameters<typeof servicesAccountService.createSubAccount>[0],
        'controlAccountId'
      > & { controlAccount: ILedgerAccount }
    ) => {
      const controlAccount = payload.controlAccount;
      const code = String(Number(controlAccount.code) + 1).padStart(6, '0');
      const materializedPath = controlAccount.materializedPath + '.' + code;
      return ledgerAccountEntity.make<ILedgerAccount>({
        name: payload.name,
        accountingEntityId: payload.accountingEntityId,
        code,
        materializedPath,
        normalBalance: 'credit',
        type: 'revenue',
        subType: 'services',
        behavior: 'services',
        isControlAccount: payload.isControlAccount,
        controlAccountId: controlAccount.id,
        currency: null,
        meta: null,
        status: 'active',
        contraAccountRule: 'contra_not_permitted',
        adjunctAccountRule: 'adjunct_not_permitted',
        createdBy: payload.createdBy,
      }) as Awaited<ReturnType<typeof servicesAccountService.createSubAccount>>;
    })({
      name: 'Services Revenue',
      accountingEntityId: accountingEntity.id,
      isControlAccount: false,
      controlAccount: servicesHeader,
      createdBy: actor.id,
    });
    mockLedgerAccountRepo.findByCode.mockResolvedValueOnce(null);
    [destinationAccount] = await cashAccountService.createHeader(
      {
        name: 'Cash',
        accountingEntity,
        createdBy: actor.id,
      },
      { correlationId }
    );
    [journalEntry, journalEntryEvents, journalEntryAudit] =
      journalEntryEntity.make({
        accountingEntityId: accountingEntity.id,
        sourceType: EJournalEntrySourceType.Receipt,
        effectiveDate: new Date('2026-08-06T00:00:00.000Z'),
        postedAt: new Date('2026-08-06T00:00:00.000Z'),
        memo: 'Receipt',
        createdBy: actor.id,
        functionalCurrency: SYSTEM_CURRENCIES.NGN,
        lines: [
          {
            accountId: sourceAccount.id,
            counterpartyId: selectedCounterparty[0].id,
            sequenceOrder: 1,
            amount: { amount: 1000n, currency: SYSTEM_CURRENCIES.NGN },
            exchangeRate: null,
            side: EJournalSide.Credit,
            description: 'Revenue',
            functionalCurrency: SYSTEM_CURRENCIES.NGN,
          },
          {
            accountId: destinationAccount.id,
            counterpartyId: selectedCounterparty[0].id,
            sequenceOrder: 2,
            amount: { amount: 1000n, currency: SYSTEM_CURRENCIES.NGN },
            exchangeRate: null,
            side: EJournalSide.Debit,
            description: 'Cash',
            functionalCurrency: SYSTEM_CURRENCIES.NGN,
          },
        ],
      });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockAppContext.get.mockReturnValue({
      actor,
      correlationId,
      idempotencyKey,
      user,
      accountingEntity,
      clientSession: mockClientSession,
    } as IAppContextData);

    mockLedgerAccountRepo.findById.mockImplementation(async (id: TEntityId) => {
      if (id === sourceAccount.id) {
        return sourceAccount;
      }
      if (id === destinationAccount.id) {
        return destinationAccount;
      }
      return null;
    });

    const counterparties = [selectedCounterparty[0]];
    mockCounterpartyRepo.findByIds.mockResolvedValue(counterparties);
    mockJournalEntryService.createReceipt.mockResolvedValue([
      journalEntry,
      journalEntryEvents,
      journalEntryAudit,
    ]);
    mockFileManagementAppService.claimUploads.mockResolvedValue([]);

    mockRepoService.createTransaction
      .mockReset()
      .mockResolvedValue(mockRepoTransaction);
    mockRepoTransaction.commit.mockReset().mockResolvedValue();
    mockRepoTransaction.handleError
      .mockReset()
      .mockImplementation(async (error) => {
        throw error;
      });
    mockOutboxAppService.createBalancePropagation.mockResolvedValue();
    mockLedgerAccountBalanceAdjustmentQueue.add.mockResolvedValue();
    mockEventBus.publish.mockResolvedValue();
    mockFxLotAppService.acquire.mockResolvedValue(null);
  });

  const getUseCase = () =>
    makeCreateReceiptUsecase({
      appContext: mockAppContext,
      counterpartyRepo: mockCounterpartyRepo,
      fileManagementAppService: mockFileManagementAppService,
      journalEntryService: mockJournalEntryService,
      ledgerAccountRepo: mockLedgerAccountRepo,
      journalEntryPersistenceAppService: mockJournalEntryPersistenceAppService,
      repoService: mockRepoService,
      eventBus: mockEventBus,
      outboxAppService: mockOutboxAppService,
      ledgerBalanceAdjustmentQueue: mockLedgerAccountBalanceAdjustmentQueue,
      fxLotAppService: mockFxLotAppService,
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
      mockJournalEntryService.createReceipt.mockRejectedValueOnce(failure);
      await expect(
        getUseCase()({
          sourceLines: [
            {
              accountId: sourceAccount.id,
              counterpartyId: selectedCounterparty[0].id,
              amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
              exchangeRate: null,
              description: 'Revenue',
              sequenceOrder: 1,
            },
          ],
          destinationLine: {
            accountId: destinationAccount.id,
            counterpartyId: selectedCounterparty[0].id,
            amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
            exchangeRate: null,
            description: 'Cash',
            sequenceOrder: 2,
          },
          effectiveDate: new Date('2026-08-06T00:00:00Z'),
          postedAt: new Date('2026-08-06T00:00:00Z'),
          memo: 'Receipt',
        })
      ).rejects.toBe(failure);
      expect(
        mockJournalEntryPersistenceAppService.create
      ).not.toHaveBeenCalled();
      expect(
        mockOutboxAppService.createBalancePropagation
      ).not.toHaveBeenCalled();
      expect(
        mockLedgerAccountBalanceAdjustmentQueue.add
      ).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );

  it('successfully orchestrates receipt creation, persists changes, propagates balances and returns DTO', async () => {
    const usecase = getUseCase();
    const fxRecords = {
      missingOfficialRateOutbox: null,
    } as unknown as TFxLotAcquisitionAppResult['records'];
    mockFxLotAppService.acquire.mockResolvedValueOnce({
      records: fxRecords,
      events: [],
    });
    const attachmentReferences = ['123e4567-e89b-12d3-a456-426614174010'];
    const attachments = [
      {
        url: 'https://files.example.com/receipt.pdf',
        name: 'receipt.pdf',
        type: 'application/pdf',
        size: 2048,
      },
    ];
    mockFileManagementAppService.claimUploads.mockResolvedValue(attachments);

    const payload = {
      attachmentReferences,
      sourceLines: [
        {
          accountId: sourceAccount.id,
          counterpartyId: selectedCounterparty[0].id,
          amount: { amount: 900, currencyCode: 'NGN', isMinorUnit: true },
          exchangeRate: null,
          description: 'Revenue',
          sequenceOrder: 1,
        },
        {
          accountId: sourceAccount.id,
          counterpartyId: selectedCounterparty[0].id,
          amount: { amount: 100, currencyCode: 'NGN', isMinorUnit: true },
          exchangeRate: null,
          description: 'VAT payable',
          sequenceOrder: 2,
        },
      ],
      destinationLine: {
        accountId: destinationAccount.id,
        counterpartyId: selectedCounterparty[0].id,
        amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
        exchangeRate: null,
        description: 'Cash',
        sequenceOrder: 3,
      },
      effectiveDate: new Date('2026-08-06T00:00:00.000Z'),
      postedAt: new Date('2026-08-06T00:00:00.000Z'),
      memo: 'Receipt',
    };

    const result = await usecase(payload);

    expect(mockFxLotAppService.acquire).toHaveBeenCalledWith(
      {
        journalEntry,
        account: destinationAccount,
        actor: actor.id,
      },
      { correlationId, idempotencyKey }
    );

    expect(mockAppContext.get).toHaveBeenCalled();
    const repoOptions = { correlationId, idempotencyKey };

    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
      sourceAccount.id,
      accountingEntity.id,
      repoOptions
    );
    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledWith(
      destinationAccount.id,
      accountingEntity.id,
      repoOptions
    );

    expect(mockCounterpartyRepo.findByIds).toHaveBeenCalledWith(
      [payload.sourceLines[0].counterpartyId],
      accountingEntity.id,
      repoOptions
    );

    expect(mockFileManagementAppService.claimUploads).toHaveBeenCalledWith({
      userId: user.id,
      purpose: EFileUploadPurpose.JournalEntryAttachment,
      references: attachmentReferences,
    });

    expect(mockJournalEntryService.createReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        header: expect.objectContaining({
          accountingEntityId: accountingEntity.id,
          memo: payload.memo,
          effectiveDate: payload.effectiveDate,
          postedAt: payload.postedAt,
        }),
        sourceLines: [
          expect.objectContaining({
            account: sourceAccount,
            counterparty: selectedCounterparty[0],
            description: 'Revenue',
          }),
          expect.objectContaining({
            account: sourceAccount,
            counterparty: selectedCounterparty[0],
            description: 'VAT payable',
          }),
        ],
        destinationLine: expect.objectContaining({
          account: destinationAccount,
          counterparty: selectedCounterparty[0],
        }),
        attachments,
      }),
      repoOptions
    );

    expect(mockRepoService.createTransaction).toHaveBeenCalled();
    expect(mockCounterpartyRepo.create).not.toHaveBeenCalled();
    expect(mockJournalEntryPersistenceAppService.create).toHaveBeenCalled();
    expect(
      mockFxLotCostBasisAppService.persistence.persistAcquisition
    ).toHaveBeenCalledWith(
      fxRecords,
      expect.objectContaining({ correlationId, tx: expect.anything() })
    );

    expect(mockOutboxAppService.createBalancePropagation).toHaveBeenCalledWith(
      journalEntry.id,
      expect.objectContaining({ correlationId, tx: expect.anything() })
    );
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).toHaveBeenCalledWith(
      correlationId,
      {
        journalEntryId: journalEntry.id,
      }
    );
    expect(mockRepoTransaction.commit.mock.invocationCallOrder[0]).toBeLessThan(
      mockLedgerAccountBalanceAdjustmentQueue.add.mock.invocationCallOrder[0]
    );

    const [publishedEvents] = mockEventBus.publish.mock.calls[0];
    expect(publishedEvents).toEqual([
      expect.objectContaining({ type: 'domain:journal-entry:created' }),
      expect.objectContaining({ type: 'domain:journal-line-item:created' }),
      expect.objectContaining({ type: 'domain:journal-line-item:created' }),
    ]);

    expect(result).toEqual(journalEntryDtoMapper.toDto(journalEntry));
  });

  it('propagates FX acquisition failure before persistence and prevents side effects', async () => {
    const failure = new Error('FX acquisition failed');
    mockFxLotAppService.acquire.mockRejectedValueOnce(failure);
    const payload = {
      sourceLines: [
        {
          accountId: sourceAccount.id,
          counterpartyId: selectedCounterparty[0].id,
          amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
          exchangeRate: null,
          description: 'Revenue',
          sequenceOrder: 1,
        },
      ],
      destinationLine: {
        accountId: destinationAccount.id,
        counterpartyId: selectedCounterparty[0].id,
        amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
        exchangeRate: null,
        description: 'Cash',
        sequenceOrder: 2,
      },
      effectiveDate: new Date('2026-08-06T00:00:00.000Z'),
      postedAt: new Date('2026-08-06T00:00:00.000Z'),
      memo: 'Receipt',
    };

    await expect(getUseCase()(payload)).rejects.toBe(failure);

    expect(mockJournalEntryPersistenceAppService.create).not.toHaveBeenCalled();
    expect(
      mockOutboxAppService.createBalancePropagation
    ).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('prevents all persistence and post-commit effects when claiming fails', async () => {
    const error = new fileAppError.InvalidUploadReference();
    mockFileManagementAppService.claimUploads.mockRejectedValue(error);

    await expect(
      getUseCase()({
        attachmentReferences: ['123e4567-e89b-12d3-a456-426614174010'],
        sourceLines: [
          {
            accountId: sourceAccount.id,
            counterpartyId: selectedCounterparty[0].id,
            amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
            exchangeRate: null,
            description: 'Revenue',
            sequenceOrder: 1,
          },
        ],
        destinationLine: {
          accountId: destinationAccount.id,
          counterpartyId: selectedCounterparty[0].id,
          amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
          exchangeRate: null,
          description: 'Cash',
          sequenceOrder: 2,
        },
        effectiveDate: new Date('2026-08-06T00:00:00.000Z'),
        postedAt: new Date('2026-08-06T00:00:00.000Z'),
        memo: 'Receipt',
      })
    ).rejects.toBe(error);

    expect(mockJournalEntryService.createReceipt).not.toHaveBeenCalled();
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    expect(mockCounterpartyRepo.create).not.toHaveBeenCalled();
    expect(mockJournalEntryPersistenceAppService.create).not.toHaveBeenCalled();
    expect(
      mockOutboxAppService.createBalancePropagation
    ).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('orchestrates successfully with existing counterparties', async () => {
    const counterparties = [existingCounterparty[0]];
    mockCounterpartyRepo.findByIds.mockResolvedValue(counterparties);
    mockJournalEntryService.createReceipt.mockResolvedValue([
      journalEntry,
      [],
      journalEntryAudit,
    ]);

    const usecase = getUseCase();

    const payload = {
      sourceLines: [
        {
          accountId: sourceAccount.id,
          counterpartyId: existingCounterparty[0].id,
          amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
          exchangeRate: null,
          description: 'Revenue',
          sequenceOrder: 1,
        },
      ],
      destinationLine: {
        accountId: destinationAccount.id,
        counterpartyId: existingCounterparty[0].id,
        amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
        exchangeRate: null,
        description: 'Cash',
        sequenceOrder: 2,
      },
      effectiveDate: new Date('2026-08-06T00:00:00.000Z'),
      postedAt: new Date('2026-08-06T00:00:00.000Z'),
      memo: 'Receipt',
    };

    await usecase(payload);

    expect(mockJournalEntryService.createReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLines: [
          expect.objectContaining({ counterparty: existingCounterparty[0] }),
        ],
        destinationLine: expect.objectContaining({
          counterparty: existingCounterparty[0],
        }),
      }),
      expect.any(Object)
    );
    expect(mockRepoService.createTransaction).toHaveBeenCalled();
    expect(mockCounterpartyRepo.create).not.toHaveBeenCalled();
    expect(mockJournalEntryPersistenceAppService.create).toHaveBeenCalled();
  });

  it('rejects with AccountNotFound when source account is not found', async () => {
    const usecase = getUseCase();

    mockLedgerAccountRepo.findById.mockResolvedValue(null);

    const payload = {
      sourceLines: [
        {
          accountId: generateUUID(),
          counterpartyId: selectedCounterparty[0].id,
          amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
          exchangeRate: null,
          description: 'Revenue',
          sequenceOrder: 1,
        },
      ],
      destinationLine: {
        accountId: destinationAccount.id,
        counterpartyId: selectedCounterparty[0].id,
        amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
        exchangeRate: null,
        description: 'Cash',
        sequenceOrder: 2,
      },
      effectiveDate: new Date('2026-08-06T00:00:00.000Z'),
      postedAt: new Date('2026-08-06T00:00:00.000Z'),
      memo: 'Receipt',
    };

    await expect(usecase(payload)).rejects.toThrow(
      ledgerAppError.AccountNotFound
    );

    expect(mockCounterpartyRepo.findByIds).not.toHaveBeenCalled();
    expect(mockJournalEntryService.createReceipt).not.toHaveBeenCalled();
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    expect(
      mockOutboxAppService.createBalancePropagation
    ).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('rejects with AccountNotFound when destination account is not found', async () => {
    const usecase = getUseCase();

    mockLedgerAccountRepo.findById.mockImplementation(async (id: TEntityId) => {
      if (id === sourceAccount.id) {
        return sourceAccount;
      }
      return null;
    });

    const payload = {
      sourceLines: [
        {
          accountId: sourceAccount.id,
          counterpartyId: selectedCounterparty[0].id,
          amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
          exchangeRate: null,
          description: 'Revenue',
          sequenceOrder: 1,
        },
      ],
      destinationLine: {
        accountId: generateUUID(),
        counterpartyId: selectedCounterparty[0].id,
        amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
        exchangeRate: null,
        description: 'Cash',
        sequenceOrder: 2,
      },
      effectiveDate: new Date('2026-08-06T00:00:00.000Z'),
      postedAt: new Date('2026-08-06T00:00:00.000Z'),
      memo: 'Receipt',
    };

    await expect(usecase(payload)).rejects.toThrow(
      ledgerAppError.AccountNotFound
    );

    expect(mockCounterpartyRepo.findByIds).toHaveBeenCalled();
    expect(mockJournalEntryService.createReceipt).not.toHaveBeenCalled();
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    expect(
      mockOutboxAppService.createBalancePropagation
    ).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it.each([
    ['domain failure', new Error('Domain Error')],
    ['draft account', new journalEntryError.DraftLedgerAccountNotAllowed()],
    ['draft counterparty', new journalEntryError.DraftCounterpartyNotAllowed()],
  ] as const)(
    'rejects %s from receipt preparation before persistence and FX effects',
    async (_, error) => {
      const usecase = getUseCase();

      mockJournalEntryService.createReceipt.mockRejectedValueOnce(error);

      const payload = {
        sourceLines: [
          {
            accountId: sourceAccount.id,
            counterpartyId: selectedCounterparty[0].id,
            amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
            exchangeRate: null,
            description: 'Revenue',
            sequenceOrder: 1,
          },
        ],
        destinationLine: {
          accountId: destinationAccount.id,
          counterpartyId: selectedCounterparty[0].id,
          amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
          exchangeRate: null,
          description: 'Cash',
          sequenceOrder: 2,
        },
        effectiveDate: new Date('2026-08-06T00:00:00.000Z'),
        postedAt: new Date('2026-08-06T00:00:00.000Z'),
        memo: 'Receipt',
      };

      await expect(usecase(payload)).rejects.toBe(error);

      expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
      expect(mockCounterpartyRepo.create).not.toHaveBeenCalled();
      expect(
        mockJournalEntryPersistenceAppService.create
      ).not.toHaveBeenCalled();
      expect(mockFxLotAppService.acquire).not.toHaveBeenCalled();
      expect(mockFxLotAppService.dispose).not.toHaveBeenCalled();
      expect(
        mockFxLotCostBasisAppService.persistence.persistAcquisition
      ).not.toHaveBeenCalled();
      expect(
        mockFxLotCostBasisAppService.persistence.persistDisposition
      ).not.toHaveBeenCalled();
      expect(
        mockOutboxAppService.createBalancePropagation
      ).not.toHaveBeenCalled();
      expect(
        mockLedgerAccountBalanceAdjustmentQueue.add
      ).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );

  it('successfully orchestrates receipt creation with exchange rates', async () => {
    const usecase = getUseCase();

    const payload = {
      sourceLines: [
        {
          accountId: sourceAccount.id,
          counterpartyId: selectedCounterparty[0].id,
          amount: { amount: 1000, currencyCode: 'USD', isMinorUnit: true },
          exchangeRate: {
            baseCurrencyCode: 'USD',
            targetCurrencyCode: 'NGN',
            rate: 1.5,
            type: 'negotiated' as const,
            asOf: new Date('2026-08-06T00:00:00.000Z'),
            source: 'test-source',
          },
          description: 'Revenue',
          sequenceOrder: 1,
        },
      ],
      destinationLine: {
        accountId: destinationAccount.id,
        counterpartyId: selectedCounterparty[0].id,
        amount: { amount: 1500, currencyCode: 'NGN', isMinorUnit: true },
        exchangeRate: {
          baseCurrencyCode: 'NGN',
          targetCurrencyCode: 'NGN',
          rate: 1.0,
          type: 'official' as const,
          asOf: new Date('2026-08-06T00:00:00.000Z'),
          source: 'test-source',
        },
        description: 'Cash',
        sequenceOrder: 2,
      },
      effectiveDate: new Date('2026-08-06T00:00:00.000Z'),
      postedAt: new Date('2026-08-06T00:00:00.000Z'),
      memo: 'Receipt',
    };

    await usecase(payload);

    expect(mockJournalEntryService.createReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLines: expect.arrayContaining([
          expect.objectContaining({
            exchangeRate: expect.any(Object),
          }),
        ]),
        destinationLine: expect.objectContaining({
          exchangeRate: expect.any(Object),
        }),
      }),
      expect.any(Object)
    );
  });

  it('rejects a partially resolved counterparty batch before preparing the journal', async () => {
    mockCounterpartyRepo.findByIds.mockResolvedValueOnce([
      selectedCounterparty[0],
    ]);

    await expect(
      getUseCase()({
        sourceLines: [
          {
            accountId: sourceAccount.id,
            counterpartyId: selectedCounterparty[0].id,
            amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
            exchangeRate: null,
            description: null,
            sequenceOrder: 1,
          },
        ],
        destinationLine: {
          accountId: destinationAccount.id,
          counterpartyId: existingCounterparty[0].id,
          amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
          exchangeRate: null,
          description: null,
          sequenceOrder: 2,
        },
        effectiveDate: new Date('2026-08-06'),
        postedAt: null,
        memo: null,
      })
    ).rejects.toThrow(counterpartyError.InvalidCounterpartyId);

    expect(mockJournalEntryService.createReceipt).not.toHaveBeenCalled();
    expect(mockFileManagementAppService.claimUploads).not.toHaveBeenCalled();
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('does not create outbox work or enqueue balance propagation for a draft receipt', async () => {
    const draftJournalEntry = {
      ...journalEntry,
      status: EJournalEntryStatus.Draft,
      postedAt: null,
    };
    mockJournalEntryService.createReceipt.mockResolvedValue([
      draftJournalEntry,
      journalEntryEvents,
      journalEntryAudit,
    ]);

    await getUseCase()({
      sourceLines: [
        {
          accountId: sourceAccount.id,
          counterpartyId: selectedCounterparty[0].id,
          amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
          exchangeRate: null,
          description: 'Revenue',
          sequenceOrder: 1,
        },
      ],
      destinationLine: {
        accountId: destinationAccount.id,
        counterpartyId: selectedCounterparty[0].id,
        amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
        exchangeRate: null,
        description: 'Cash',
        sequenceOrder: 2,
      },
      effectiveDate: new Date('2026-08-06T00:00:00.000Z'),
      postedAt: null,
      memo: 'Draft receipt',
    });

    expect(mockFxLotAppService.acquire).toHaveBeenCalledWith(
      {
        journalEntry: draftJournalEntry,
        account: destinationAccount,
        actor: actor.id,
      },
      { correlationId, idempotencyKey }
    );
    expect(mockJournalEntryPersistenceAppService.create).toHaveBeenCalled();
    expect(
      mockOutboxAppService.createBalancePropagation
    ).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
  });

  it('rejects on validation failure and prevents side-effects', async () => {
    const usecase = getUseCase();

    const payload = {
      sourceLines: [],
      destinationLine: {
        // Missing accountId
        counterpartyId: selectedCounterparty[0].id,
        amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
        exchangeRate: null,
        description: 'Cash',
        sequenceOrder: 1,
      },
      effectiveDate: new Date('2026-08-06T00:00:00.000Z'),
      postedAt: new Date('2026-08-06T00:00:00.000Z'),
      memo: 'Receipt',
    };

    await expect(usecase(payload as never)).rejects.toThrow();

    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
    expect(mockCounterpartyRepo.findByIds).not.toHaveBeenCalled();
  });
  it('propagates counterparty read failures before journal preparation or persistence', async () => {
    const failure = new Error('counterparty read failed');
    mockCounterpartyRepo.findByIds.mockRejectedValueOnce(failure);

    await expect(
      getUseCase()({
        sourceLines: [
          {
            accountId: sourceAccount.id,
            counterpartyId: selectedCounterparty[0].id,
            amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
            exchangeRate: null,
            description: null,
            sequenceOrder: 1,
          },
        ],
        destinationLine: {
          accountId: destinationAccount.id,
          counterpartyId: selectedCounterparty[0].id,
          amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
          exchangeRate: null,
          description: null,
          sequenceOrder: 2,
        },
        effectiveDate: new Date('2026-08-06'),
        postedAt: null,
        memo: null,
      })
    ).rejects.toBe(failure);

    expect(mockJournalEntryService.createReceipt).not.toHaveBeenCalled();
    expect(mockFileManagementAppService.claimUploads).not.toHaveBeenCalled();
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
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
          sourceLines: [
            {
              accountId: sourceAccount.id,
              counterpartyId: selectedCounterparty[0].id,
              amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
              exchangeRate: null,
              description: 'Revenue',
              sequenceOrder: 1,
            },
          ],
          destinationLine: {
            accountId: destinationAccount.id,
            counterpartyId: selectedCounterparty[0].id,
            amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
            exchangeRate: null,
            description: 'Cash',
            sequenceOrder: 2,
          },
          effectiveDate: new Date('2026-08-06T00:00:00Z'),
          postedAt: new Date('2026-08-06T00:00:00Z'),
          memo: 'Receipt',
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
