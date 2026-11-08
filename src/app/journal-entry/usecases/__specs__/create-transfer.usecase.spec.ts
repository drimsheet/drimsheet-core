import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import periodError from '@domain/accounting/errors/period.error';
import { EAccountingEntityType } from '@domain/accounting/types/accounting-entity.types';
import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import { ECounterpartyType } from '@domain/counterparty/types/counterparty.types';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import { EJournalEntrySourceType } from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import {
  EAssetAccountBehavior,
  EAssetSubType,
} from '@domain/ledger/types/asset-account.types';
import {
  EExpenseAccountBehavior,
  EExpenseSubType,
} from '@domain/ledger/types/expense-account.types';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerAccountStatus,
  ELedgerType,
} from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import { EExchangeRateType } from '@domain/money/types/exchange-rate.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';
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
import { mockTransferEntryService } from '@app/journal-entry/contracts/__mocks__/journal-entry.domain.services.mock';
import journalEntryDtoMapper from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.mapper';
import { ITransferEntryReq } from '@app/journal-entry/dtos/transfer-entry/transfer-entry.dto';
import makeCreateTransferUsecase from '@app/journal-entry/usecases/create-transfer.usecase';
import mockLedgerAccountBalanceAdjustmentQueue from '@app/ledger/contracts/__mocks__/ledger-balance-adjustment-queue.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import mockExchangeRateAppService from '@app/money/contracts/__mocks__/exchange-rate.service.mock';
import mockOutboxAppService from '@app/outbox/contracts/__mocks__/outbox.service.mock';
import { mockFxCostBasisLotService } from '@app/subledger/contracts/__mocks__/subledger.domain.services.mock';
import {
  makeFxAcquisitionResult,
  makeFxDispositionResult,
} from '@app/subledger/fx-cost-basis/__fixtures__/fx-lot-results.fixture';
import mockFxLotCostBasisAppService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-cost-basis-persistence.service.mock';

const actor = {
  ...actorEntity.makeUser({
    email: 'actor@example.com',
    displayName: 'Actor',
  })[0],
  id: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
};

describe('makeCreateTransferUsecase', () => {
  const correlationId = 'transfer-correlation-id';
  const idempotencyKey = 'transfer-idempotency-key';
  const effectiveDate = new Date('2026-08-30T00:00:00.000Z');
  const user: IUser = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    actorId: 'b2222222-2222-4222-8222-222222222222' as TEntityId,
    id: generateUUID(),
    version: 1,
    email: 'transfer@example.com',
    emailVerified: true,
    firstName: 'Transfer',
    lastName: 'Maker',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
  const [accountingEntity] = accountingEntityEntity.make({
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    name: 'Transfer Entity',
    ownerId: user.id,
    type: EAccountingEntityType.Individual,
    functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
    jurisdictionCode: 'NG',
  });

  function makeAccount(
    code: string,
    behavior: (typeof EAssetAccountBehavior)[keyof typeof EAssetAccountBehavior],
    currency = SYSTEM_CURRENCIES.NGN
  ) {
    const [account] = ledgerAccountEntity.make({
      code,
      materializedPath: code,
      accountingEntityId: accountingEntity.id,
      type: ELedgerType.Asset,
      subType: EAssetSubType.CashAndCashEquivalent,
      behavior,
      normalBalance: EJournalSide.Debit,
      isControlAccount: false,
      controlAccountId: null,
      name: `Transfer account ${code}`,
      currency,
      status: ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
      meta: {},
      createdBy: actor.id,
    });

    return account;
  }

  const sourceAccount = makeAccount('100001', EAssetAccountBehavior.Bank);
  const destinationAccount = makeAccount(
    '100002',
    EAssetAccountBehavior.PettyCash
  );
  const usdSourceAccount = makeAccount(
    '100003',
    EAssetAccountBehavior.Bank,
    SYSTEM_CURRENCIES.USD
  );
  const usdDestinationAccount = makeAccount(
    '100004',
    EAssetAccountBehavior.PettyCash,
    SYSTEM_CURRENCIES.USD
  );
  const [bankChargeAccount] = ledgerAccountEntity.make({
    code: '507001',
    materializedPath: '507001',
    accountingEntityId: accountingEntity.id,
    type: ELedgerType.Expense,
    subType: EExpenseSubType.BankCharge,
    behavior: EExpenseAccountBehavior.BankCharge,
    normalBalance: EJournalSide.Debit,
    isControlAccount: false,
    controlAccountId: null,
    name: 'Bank charges',
    currency: SYSTEM_CURRENCIES.NGN,
    status: ELedgerAccountStatus.Active,
    contraAccountRule: EContraAccountRule.ContraPermitted,
    adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
    meta: {},
    createdBy: actor.id,
  });
  const bankCounterparty = counterpartyEntity.make({
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    accountingEntityId: accountingEntity.id,
    name: 'Transfer provider',
    type: ECounterpartyType.Organization,
  });
  const attachments = [
    {
      url: 'https://files.example.com/transfer.pdf',
      name: 'transfer.pdf',
      type: 'application/pdf',
      size: 2048,
    },
  ];

  function makePayload(): ITransferEntryReq {
    return {
      attachmentReferences: ['123e4567-e89b-12d3-a456-426614174010'],
      sourceLine: {
        accountId: sourceAccount.id,
        amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
        exchangeRate: null,
        description: 'Transfer from bank',
        sequenceOrder: 1,
      },
      destinationLine: {
        accountId: destinationAccount.id,
        amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
        exchangeRate: null,
        description: 'Transfer to petty cash',
        sequenceOrder: 2,
      },
      chargeLines: [],
      effectiveDate,
      postedAt: effectiveDate,
      memo: 'Cash transfer',
    };
  }

  function makeJournalEntry(postedAt: Date | null) {
    return journalEntryEntity.make({
      accountingEntityId: accountingEntity.id,
      sourceType: EJournalEntrySourceType.Transfer,
      effectiveDate,
      postedAt,
      memo: 'Cash transfer',
      createdBy: actor.id,
      functionalCurrency: SYSTEM_CURRENCIES.NGN,
      attachments,
      lines: [
        {
          accountId: sourceAccount.id,
          counterpartyId: null,
          sequenceOrder: 1,
          amount: { amount: 1000n, currency: SYSTEM_CURRENCIES.NGN },
          exchangeRate: null,
          side: EJournalSide.Credit,
          description: 'Transfer from bank',
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
        {
          accountId: destinationAccount.id,
          counterpartyId: null,
          sequenceOrder: 2,
          amount: { amount: 1000n, currency: SYSTEM_CURRENCIES.NGN },
          exchangeRate: null,
          side: EJournalSide.Debit,
          description: 'Transfer to petty cash',
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
      ],
    });
  }

  const postedJournalEntry = makeJournalEntry(effectiveDate);

  function getUseCase() {
    return makeCreateTransferUsecase({
      appContext: mockAppContext,
      counterpartyRepo: mockCounterpartyRepo,
      fileManagementAppService: mockFileManagementAppService,
      transferEntryService: mockTransferEntryService,
      ledgerAccountRepo: mockLedgerAccountRepo,
      journalEntryPersistenceAppService: mockJournalEntryPersistenceAppService,
      repoService: mockRepoService,
      eventBus: mockEventBus,
      outboxAppService: mockOutboxAppService,
      ledgerBalanceAdjustmentQueue: mockLedgerAccountBalanceAdjustmentQueue,
      fxCostBasisLotService: mockFxCostBasisLotService,
      exchangeRateAppService: mockExchangeRateAppService,
      fxCostBasisPersistenceAppService:
        mockFxLotCostBasisAppService.persistence,
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockExchangeRateAppService.getOfficialRate.mockResolvedValue(null);
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
      if (id === usdSourceAccount.id) {
        return usdSourceAccount;
      }
      if (id === usdDestinationAccount.id) {
        return usdDestinationAccount;
      }
      if (id === bankChargeAccount.id) {
        return bankChargeAccount;
      }
      return null;
    });
    mockFileManagementAppService.claimUploads.mockResolvedValue(attachments);
    mockCounterpartyRepo.findByIds.mockResolvedValue([]);
    mockTransferEntryService.create.mockResolvedValue({
      journalEntry: postedJournalEntry,
      destinationAssetAccount: destinationAccount,
    });
    mockRepoService.createTransaction
      .mockReset()
      .mockResolvedValue(mockRepoTransaction);
    mockRepoTransaction.commit.mockReset().mockResolvedValue();
    mockRepoTransaction.handleError
      .mockReset()
      .mockImplementation(async (error) => {
        throw error;
      });
    mockJournalEntryPersistenceAppService.create.mockResolvedValue();
    mockCounterpartyRepo.create.mockResolvedValue();
    mockOutboxAppService.createBalancePropagation.mockResolvedValue();
    mockLedgerAccountBalanceAdjustmentQueue.add.mockResolvedValue();
    mockEventBus.publish.mockResolvedValue();
    mockFxCostBasisLotService.dispose.mockResolvedValue(null);
    mockFxCostBasisLotService.acquire.mockReturnValue(null);
    mockFxLotCostBasisAppService.persistence.persistDisposition.mockResolvedValue();
    mockFxLotCostBasisAppService.persistence.persistAcquisition.mockResolvedValue();
  });

  it.each([
    new journalEntryError.ArchivedLedgerAccountNotAllowed(),
    new periodError.PostingDateNotCovered(),
    new periodError.PostingPeriodAmbiguous(),
    new periodError.PostingPeriodNotOpen(),
  ])(
    'does not persist or publish when journal creation rejects: %s',
    async (failure) => {
      mockTransferEntryService.create.mockRejectedValueOnce(failure);
      await expect(getUseCase()(makePayload())).rejects.toBe(failure);
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

  it('orchestrates a posted transfer with attachments and returns its DTO', async () => {
    const payload = makePayload();

    const result = await getUseCase()(payload);
    const repoOptions = { correlationId, idempotencyKey };

    expect(mockLedgerAccountRepo.findById).toHaveBeenNthCalledWith(
      1,
      sourceAccount.id,
      accountingEntity.id,
      repoOptions
    );
    expect(mockLedgerAccountRepo.findById).toHaveBeenNthCalledWith(
      2,
      destinationAccount.id,
      accountingEntity.id,
      repoOptions
    );
    expect(mockFileManagementAppService.claimUploads).toHaveBeenCalledWith({
      userId: user.id,
      purpose: EFileUploadPurpose.JournalEntryAttachment,
      references: payload.attachmentReferences,
    });
    expect(mockTransferEntryService.create).toHaveBeenCalledWith(
      {
        attachments,
        header: {
          accountingEntityId: accountingEntity.id,
          memo: payload.memo,
          effectiveDate: payload.effectiveDate,
          postedAt: payload.postedAt,
          functionalCurrencyCode: accountingEntity.functionalCurrencyCode,
          createdBy: actor.id,
        },
        sourceLine: expect.objectContaining({
          account: sourceAccount,
          amount: expect.objectContaining({ amount: 1000n }),
          exchangeRate: null,
        }),
        destinationLines: [
          expect.objectContaining({
            account: destinationAccount,
            counterparty: null,
            amount: expect.objectContaining({ amount: 1000n }),
            exchangeRate: null,
          }),
        ],
      },
      repoOptions
    );
    expect(mockJournalEntryPersistenceAppService.create).toHaveBeenCalledWith(
      postedJournalEntry[0],
      expect.any(Object),
      expect.any(Array),
      { correlationId, tx: mockRepoTransaction.context }
    );
    expect(mockOutboxAppService.createBalancePropagation).toHaveBeenCalledWith(
      postedJournalEntry[0].id,
      { correlationId, tx: mockRepoTransaction.context }
    );
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).toHaveBeenCalledWith(
      correlationId,
      {
        journalEntryId: postedJournalEntry[0].id,
      }
    );
    expect(mockFxCostBasisLotService.dispose).toHaveBeenCalledWith(
      {
        journalEntry: postedJournalEntry[0],
        account: sourceAccount,
        createdBy: actor.id,
        officialRate: null,
      },
      { correlationId, idempotencyKey }
    );
    expect(mockFxCostBasisLotService.acquire).toHaveBeenCalledWith({
      journalEntry: postedJournalEntry[0],
      account: destinationAccount,
      createdBy: actor.id,
      officialRate: null,
    });
    expect(
      mockFxLotCostBasisAppService.persistence.persistDisposition
    ).not.toHaveBeenCalled();
    expect(
      mockFxLotCostBasisAppService.persistence.persistAcquisition
    ).not.toHaveBeenCalled();
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    expect(result).toEqual(journalEntryDtoMapper.toDto(postedJournalEntry[0]));
  });

  it('maps charge lines with counterparties while acquiring only the domain-classified asset', async () => {
    const payload = makePayload();
    payload.destinationLine.amount = {
      amount: 900,
      currencyCode: 'NGN',
      isMinorUnit: true,
    };
    payload.chargeLines = [
      {
        accountId: bankChargeAccount.id,
        counterpartyId: bankCounterparty[0].id,
        amount: { amount: 50, currencyCode: 'NGN', isMinorUnit: true },
        exchangeRate: null,
        description: 'Transfer fee',
        sequenceOrder: 3,
      },
      {
        accountId: bankChargeAccount.id,
        counterpartyId: null,
        amount: { amount: 50, currencyCode: 'NGN', isMinorUnit: true },
        exchangeRate: null,
        description: 'Bank fee',
        sequenceOrder: 4,
      },
    ];
    mockCounterpartyRepo.findByIds.mockResolvedValueOnce([bankCounterparty[0]]);

    await getUseCase()(payload);

    expect(mockLedgerAccountRepo.findById).toHaveBeenNthCalledWith(
      2,
      destinationAccount.id,
      accountingEntity.id,
      { correlationId, idempotencyKey }
    );
    expect(mockLedgerAccountRepo.findById).toHaveBeenNthCalledWith(
      3,
      bankChargeAccount.id,
      accountingEntity.id,
      { correlationId, idempotencyKey }
    );
    expect(mockLedgerAccountRepo.findById).toHaveBeenNthCalledWith(
      4,
      bankChargeAccount.id,
      accountingEntity.id,
      { correlationId, idempotencyKey }
    );
    expect(mockCounterpartyRepo.findByIds).toHaveBeenCalledWith(
      [payload.chargeLines[0].counterpartyId],
      accountingEntity.id,
      { correlationId, idempotencyKey }
    );
    expect(mockTransferEntryService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationLines: [
          expect.objectContaining({
            account: destinationAccount,
            counterparty: null,
          }),
          expect.objectContaining({
            account: bankChargeAccount,
            counterparty: bankCounterparty[0],
          }),
          expect.objectContaining({
            account: bankChargeAccount,
            counterparty: null,
          }),
        ],
      }),
      { correlationId, idempotencyKey }
    );
    expect(mockFxCostBasisLotService.acquire).toHaveBeenCalledTimes(1);
    expect(mockFxCostBasisLotService.acquire).toHaveBeenCalledWith(
      expect.objectContaining({
        account: destinationAccount,
        officialRate: null,
      })
    );
    expect(mockFxCostBasisLotService.acquire).not.toHaveBeenCalledWith(
      expect.objectContaining({
        account: bankChargeAccount,
        officialRate: null,
      })
    );
    const [publishedEvents] = mockEventBus.publish.mock.calls[0];
    expect(publishedEvents).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ type: bankCounterparty[1][0].type }),
      ])
    );
  });

  it('maps a charge exchange rate with no counterparty', async () => {
    const payload = makePayload();
    payload.chargeLines = [
      {
        accountId: bankChargeAccount.id,
        counterpartyId: null,
        amount: { amount: 50, currencyCode: 'NGN', isMinorUnit: true },
        exchangeRate: {
          baseCurrencyCode: 'USD',
          targetCurrencyCode: 'NGN',
          rate: 1600,
          type: EExchangeRateType.Official,
          asOf: effectiveDate,
          source: 'Test Source',
        },
        description: 'Transfer fee',
        sequenceOrder: 3,
      },
    ];

    await getUseCase()(payload);

    expect(mockTransferEntryService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationLines: expect.arrayContaining([
          expect.objectContaining({
            account: bankChargeAccount,
            counterparty: null,
            exchangeRate: expect.objectContaining({
              baseCurrencyCode: 'USD',
              targetCurrencyCode: 'NGN',
            }),
          }),
        ]),
      }),
      { correlationId, idempotencyKey }
    );
  });

  it('skips persistence for an existing charge counterparty', async () => {
    const payload = makePayload();
    payload.chargeLines = [
      {
        accountId: bankChargeAccount.id,
        counterpartyId: bankCounterparty[0].id,
        amount: { amount: 50, currencyCode: 'NGN', isMinorUnit: true },
        exchangeRate: null,
        description: 'Transfer fee',
        sequenceOrder: 3,
      },
    ];
    mockCounterpartyRepo.findByIds.mockResolvedValueOnce([bankCounterparty[0]]);

    await getUseCase()(payload);

    expect(mockTransferEntryService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationLines: expect.arrayContaining([
          expect.objectContaining({
            account: bankChargeAccount,
            counterparty: bankCounterparty[0],
          }),
        ]),
      }),
      { correlationId, idempotencyKey }
    );
    expect(mockCounterpartyRepo.create).not.toHaveBeenCalled();
  });

  it('persists a draft without creating balance propagation work', async () => {
    const payload = makePayload();
    payload.postedAt = null;
    const draftJournalEntry = makeJournalEntry(null);
    mockTransferEntryService.create.mockResolvedValue({
      journalEntry: draftJournalEntry,
      destinationAssetAccount: destinationAccount,
    });

    await getUseCase()(payload);

    expect(mockJournalEntryPersistenceAppService.create).toHaveBeenCalledTimes(
      1
    );
    expect(
      mockOutboxAppService.createBalancePropagation
    ).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
    expect(mockFxCostBasisLotService.dispose).not.toHaveBeenCalled();
    expect(mockFxCostBasisLotService.acquire).not.toHaveBeenCalled();
    expect(mockExchangeRateAppService.getOfficialRate).not.toHaveBeenCalled();
    expect(
      mockFxLotCostBasisAppService.persistence.persistDisposition
    ).not.toHaveBeenCalled();
    expect(
      mockFxLotCostBasisAppService.persistence.persistAcquisition
    ).not.toHaveBeenCalled();
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('maps source and destination exchange rates', async () => {
    const payload = makePayload();
    const exchangeRate = {
      baseCurrencyCode: 'USD',
      targetCurrencyCode: 'NGN',
      rate: 1600,
      type: 'official' as const,
      asOf: effectiveDate,
      source: 'Test Source',
    };
    payload.sourceLine = {
      ...payload.sourceLine,
      accountId: usdSourceAccount.id,
      amount: { amount: 100, currencyCode: 'USD', isMinorUnit: true },
      exchangeRate,
    };
    payload.destinationLine.amount = {
      amount: 160_000,
      currencyCode: 'NGN',
      isMinorUnit: true,
    };

    await getUseCase()(payload);

    expect(mockTransferEntryService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLine: expect.objectContaining({
          exchangeRate: expect.objectContaining({
            baseCurrencyCode: 'USD',
            targetCurrencyCode: 'NGN',
          }),
        }),
        destinationLines: [
          expect.objectContaining({
            account: destinationAccount,
            exchangeRate: null,
          }),
        ],
      }),
      { correlationId, idempotencyKey }
    );
  });

  it('uses an empty attachment list when references are omitted', async () => {
    const payload = makePayload();
    delete payload.attachmentReferences;

    await getUseCase()(payload);

    expect(mockFileManagementAppService.claimUploads).toHaveBeenCalledWith(
      expect.objectContaining({ references: [] })
    );
  });

  it('rejects a missing source account before claiming uploads', async () => {
    mockLedgerAccountRepo.findById.mockResolvedValueOnce(null);

    const payload = makePayload();

    await expect(getUseCase()(payload)).rejects.toMatchObject({
      cause: { id: payload.sourceLine.accountId },
    });
    expect(mockFileManagementAppService.claimUploads).not.toHaveBeenCalled();
    expect(mockTransferEntryService.create).not.toHaveBeenCalled();
  });

  it('rejects a missing destination account before claiming uploads', async () => {
    mockLedgerAccountRepo.findById
      .mockResolvedValueOnce(sourceAccount)
      .mockResolvedValueOnce(null);

    const payload = makePayload();

    await expect(getUseCase()(payload)).rejects.toMatchObject({
      cause: { id: payload.destinationLine.accountId },
    });
    expect(mockFileManagementAppService.claimUploads).not.toHaveBeenCalled();
    expect(mockTransferEntryService.create).not.toHaveBeenCalled();
  });

  it('rejects the exact missing charge account before resolving counterparties', async () => {
    const payload = makePayload();
    payload.chargeLines = [
      {
        accountId: bankChargeAccount.id,
        counterpartyId: null,
        amount: { amount: 50, currencyCode: 'NGN', isMinorUnit: true },
        exchangeRate: null,
        description: 'Transfer fee',
        sequenceOrder: 3,
      },
    ];
    mockLedgerAccountRepo.findById
      .mockResolvedValueOnce(sourceAccount)
      .mockResolvedValueOnce(destinationAccount)
      .mockResolvedValueOnce(null);

    await expect(getUseCase()(payload)).rejects.toMatchObject({
      cause: { id: payload.chargeLines[0].accountId },
    });
    expect(mockCounterpartyRepo.findByIds).not.toHaveBeenCalled();
    expect(mockFileManagementAppService.claimUploads).not.toHaveBeenCalled();
    expect(mockTransferEntryService.create).not.toHaveBeenCalled();
  });

  it('prevents domain creation and persistence when attachment claiming fails', async () => {
    mockFileManagementAppService.claimUploads.mockRejectedValueOnce(
      new fileAppError.InvalidUploadReference()
    );

    await expect(getUseCase()(makePayload())).rejects.toThrow(
      fileAppError.InvalidUploadReference
    );
    expect(mockTransferEntryService.create).not.toHaveBeenCalled();
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('prevents persistence when domain creation fails', async () => {
    mockTransferEntryService.create.mockRejectedValueOnce(
      new Error('domain failure')
    );

    await expect(getUseCase()(makePayload())).rejects.toThrow('domain failure');
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it.each([
    ['account', journalEntryError.DraftLedgerAccountNotAllowed],
    ['counterparty', journalEntryError.DraftCounterpartyNotAllowed],
  ] as const)(
    'stops before journal, FX, and propagation writes when a draft %s blocks posting',
    async (_, ErrorType) => {
      const error = new ErrorType();
      mockTransferEntryService.create.mockRejectedValueOnce(error);

      await expect(getUseCase()(makePayload())).rejects.toBe(error);

      expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
      expect(mockCounterpartyRepo.create).not.toHaveBeenCalled();
      expect(
        mockJournalEntryPersistenceAppService.create
      ).not.toHaveBeenCalled();
      expect(mockFxCostBasisLotService.dispose).not.toHaveBeenCalled();
      expect(mockFxCostBasisLotService.acquire).not.toHaveBeenCalled();
      expect(
        mockFxLotCostBasisAppService.persistence.persistDisposition
      ).not.toHaveBeenCalled();
      expect(
        mockFxLotCostBasisAppService.persistence.persistAcquisition
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

  it('does not run post-commit effects when the transaction fails', async () => {
    mockRepoTransaction.commit.mockRejectedValueOnce(
      new Error('transaction failure')
    );

    await expect(getUseCase()(makePayload())).rejects.toThrow(
      'transaction failure'
    );
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('coordinates both FX lot effects for a foreign-to-foreign transfer in one transaction and publishes their events in order', async () => {
    const payload = makePayload();
    const exchangeRateDto = {
      baseCurrencyCode: SYSTEM_CURRENCIES.USD.code,
      targetCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
      rate: 1600,
      type: EExchangeRateType.Official,
      asOf: effectiveDate,
      source: 'Test Source',
    };
    const exchangeRate = exchangeRateValue.make(exchangeRateDto);
    mockExchangeRateAppService.getOfficialRate.mockResolvedValueOnce(
      exchangeRate
    );
    mockExchangeRateAppService.getOfficialRate.mockResolvedValueOnce(
      exchangeRate
    );
    payload.sourceLine = {
      ...payload.sourceLine,
      accountId: usdSourceAccount.id,
      amount: { amount: 100, currencyCode: 'USD', isMinorUnit: true },
      exchangeRate: exchangeRateDto,
    };
    payload.destinationLine = {
      ...payload.destinationLine,
      accountId: usdDestinationAccount.id,
      amount: { amount: 100, currencyCode: 'USD', isMinorUnit: true },
      exchangeRate: exchangeRateDto,
    };
    const foreignJournalEntry = journalEntryEntity.make({
      accountingEntityId: accountingEntity.id,
      sourceType: EJournalEntrySourceType.Transfer,
      effectiveDate,
      postedAt: effectiveDate,
      memo: payload.memo,
      createdBy: actor.id,
      functionalCurrency: SYSTEM_CURRENCIES.NGN,
      attachments,
      lines: [
        {
          accountId: usdSourceAccount.id,
          counterpartyId: null,
          sequenceOrder: 1,
          amount: { amount: 100n, currency: SYSTEM_CURRENCIES.USD },
          exchangeRate,
          side: EJournalSide.Credit,
          description: payload.sourceLine.description,
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
        {
          accountId: usdDestinationAccount.id,
          counterpartyId: null,
          sequenceOrder: 2,
          amount: { amount: 100n, currency: SYSTEM_CURRENCIES.USD },
          exchangeRate,
          side: EJournalSide.Debit,
          description: payload.destinationLine.description,
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
      ],
    });
    mockTransferEntryService.create.mockResolvedValueOnce({
      journalEntry: foreignJournalEntry,
      destinationAssetAccount: usdDestinationAccount,
    });
    const fxDisposition = makeFxDispositionResult();
    const fxAcquisition = makeFxAcquisitionResult();
    const [[, consumedLotEvents]] = fxDisposition.lots;
    const [, dispositionEvents] = fxDisposition.disposition;
    const [, acquiredLotEvents] = fxAcquisition.lot;
    const [, acquisitionEvents] = fxAcquisition.acquisition;
    mockFxCostBasisLotService.dispose.mockResolvedValueOnce(fxDisposition);
    mockFxCostBasisLotService.acquire.mockReturnValueOnce(fxAcquisition);

    await getUseCase()(payload);

    expect(mockExchangeRateAppService.getOfficialRate).toHaveBeenCalledTimes(2);
    expect(mockExchangeRateAppService.getOfficialRate).toHaveBeenCalledWith(
      exchangeRate.currencyPair,
      exchangeRate.asOf,
      { correlationId, idempotencyKey },
      exchangeRate
    );
    const writeOptions = { correlationId, tx: mockRepoTransaction.context };
    expect(mockFxCostBasisLotService.dispose).toHaveBeenCalledWith(
      {
        journalEntry: foreignJournalEntry[0],
        account: usdSourceAccount,
        createdBy: actor.id,
        officialRate: exchangeRate,
      },
      { correlationId, idempotencyKey }
    );
    expect(mockFxCostBasisLotService.acquire).toHaveBeenCalledWith({
      journalEntry: foreignJournalEntry[0],
      account: usdDestinationAccount,
      createdBy: actor.id,
      officialRate: exchangeRate,
    });
    expect(
      mockFxLotCostBasisAppService.persistence.persistDisposition
    ).toHaveBeenCalledWith(fxDisposition, actor.id, writeOptions);
    expect(
      mockFxLotCostBasisAppService.persistence.persistAcquisition
    ).toHaveBeenCalledWith(fxAcquisition, actor.id, writeOptions);
    expect(
      mockJournalEntryPersistenceAppService.create.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mockFxLotCostBasisAppService.persistence.persistDisposition.mock
        .invocationCallOrder[0]
    );
    expect(
      mockFxLotCostBasisAppService.persistence.persistDisposition.mock
        .invocationCallOrder[0]
    ).toBeLessThan(
      mockFxLotCostBasisAppService.persistence.persistAcquisition.mock
        .invocationCallOrder[0]
    );
    expect(
      mockFxLotCostBasisAppService.persistence.persistAcquisition.mock
        .invocationCallOrder[0]
    ).toBeLessThan(
      mockOutboxAppService.createBalancePropagation.mock.invocationCallOrder[0]
    );
    const [publishedEvents] = mockEventBus.publish.mock.calls[0];
    expect(Array.isArray(publishedEvents)).toBe(true);
    if (!Array.isArray(publishedEvents)) {
      throw new Error('Expected transfer events to be published as an array');
    }
    const fxEvents = [
      ...consumedLotEvents,
      ...dispositionEvents,
      ...acquiredLotEvents,
      ...acquisitionEvents,
    ];
    expect(publishedEvents.slice(-fxEvents.length)).toEqual(
      fxEvents.map(({ type, data }) => expect.objectContaining({ type, data }))
    );
  });

  it('persists only a source disposition when acquisition preparation returns null', async () => {
    const fxDisposition = makeFxDispositionResult();
    mockFxCostBasisLotService.dispose.mockResolvedValueOnce(fxDisposition);

    await getUseCase()(makePayload());

    expect(
      mockFxLotCostBasisAppService.persistence.persistDisposition
    ).toHaveBeenCalledWith(fxDisposition, actor.id, {
      correlationId,
      tx: mockRepoTransaction.context,
    });
    expect(
      mockFxLotCostBasisAppService.persistence.persistAcquisition
    ).not.toHaveBeenCalled();
  });

  it('persists only a destination acquisition when disposition preparation returns null', async () => {
    const fxAcquisition = makeFxAcquisitionResult();
    mockFxCostBasisLotService.acquire.mockReturnValueOnce(fxAcquisition);

    await getUseCase()(makePayload());

    expect(
      mockFxLotCostBasisAppService.persistence.persistDisposition
    ).not.toHaveBeenCalled();
    expect(
      mockFxLotCostBasisAppService.persistence.persistAcquisition
    ).toHaveBeenCalledWith(fxAcquisition, actor.id, {
      correlationId,
      tx: mockRepoTransaction.context,
    });
  });

  it('prevents persistence when disposition preparation fails', async () => {
    const failure = new Error('FX disposition failed');
    mockFxCostBasisLotService.dispose.mockRejectedValueOnce(failure);

    await expect(getUseCase()(makePayload())).rejects.toBe(failure);

    expect(mockFxCostBasisLotService.acquire).not.toHaveBeenCalled();
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('prevents persistence when acquisition preparation fails', async () => {
    const failure = new Error('FX acquisition failed');
    mockFxCostBasisLotService.acquire.mockImplementationOnce(() => {
      throw failure;
    });

    await expect(getUseCase()(makePayload())).rejects.toBe(failure);

    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('does not run post-commit effects when FX persistence fails', async () => {
    const fxDisposition = makeFxDispositionResult();
    mockFxCostBasisLotService.dispose.mockResolvedValueOnce(fxDisposition);
    mockFxLotCostBasisAppService.persistence.persistDisposition.mockRejectedValueOnce(
      new Error('FX persistence failed')
    );

    await expect(getUseCase()(makePayload())).rejects.toThrow(
      'FX persistence failed'
    );

    expect(
      mockOutboxAppService.createBalancePropagation
    ).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('rejects invalid input before reading request context', async () => {
    const payload = makePayload();
    delete (payload as Partial<ITransferEntryReq>).destinationLine;

    await expect(getUseCase()(payload)).rejects.toThrow();
    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
  });
  it('propagates counterparty read failures before journal preparation or persistence', async () => {
    const failure = new Error('counterparty read failed');
    mockCounterpartyRepo.findByIds.mockRejectedValueOnce(failure);

    await expect(getUseCase()(makePayload())).rejects.toBe(failure);

    expect(mockTransferEntryService.create).not.toHaveBeenCalled();
    expect(mockFileManagementAppService.claimUploads).not.toHaveBeenCalled();
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
  it('rejects a charge ID omitted from a partial repository result before uploads or writes', async () => {
    const payload = makePayload();
    const chargeLine = {
      accountId: bankChargeAccount.id,
      counterpartyId: bankCounterparty[0].id,
      amount: { amount: 50, currencyCode: 'NGN', isMinorUnit: true },
      exchangeRate: null,
      description: 'Transfer fee',
      sequenceOrder: 3,
    };
    const missingId = generateUUID();
    payload.chargeLines = [
      chargeLine,
      {
        ...chargeLine,
        counterpartyId: missingId,
        sequenceOrder: 4,
      },
    ];
    mockCounterpartyRepo.findByIds.mockResolvedValueOnce([bankCounterparty[0]]);

    await expect(getUseCase()(payload)).rejects.toMatchObject({
      errorKey: new counterpartyError.InvalidCounterpartyId().errorKey,
      cause: { id: missingId },
    });

    expect(mockTransferEntryService.create).not.toHaveBeenCalled();
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

      await expect(getUseCase()(makePayload())).rejects.toBe(failure);

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
