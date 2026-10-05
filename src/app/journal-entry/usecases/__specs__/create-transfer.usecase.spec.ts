import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import { ITransactionContext } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import { EAccountingEntityType } from '@domain/accounting/types/accounting-entity.types';
import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
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
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import { mockCounterpartyRepo } from '@app/counterparty/contracts/__mocks__/counterparty.repos.mock';
import mockCounterpartyAppService from '@app/counterparty/contracts/__mocks__/counterparty.service.mock';
import { ICounterpartyFindOrCreateRes } from '@app/counterparty/contracts/counterparty.service.contract';
import mockFileManagementService from '@app/file/contracts/__mocks__/file-management.service.mock';
import fileAppError from '@app/file/errors/file.error';
import { EFileUploadPurpose } from '@app/file/types/file.types';
import mockJournalEntryPersistenceService from '@app/journal-entry/contracts/__mocks__/journal-entry-persistence.service.mock';
import { mockJournalEntryService } from '@app/journal-entry/contracts/__mocks__/journal-entry.domain.services.mock';
import journalEntryDtoMapper from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.mapper';
import { ITransferEntryReq } from '@app/journal-entry/dtos/transfer-entry/transfer-entry.dto';
import makeCreateTransferUsecase from '@app/journal-entry/usecases/create-transfer.usecase';
import mockLedgerAccountBalanceAdjustmentQueue from '@app/ledger/contracts/__mocks__/ledger-balance-adjustment-queue.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import mockOutboxService from '@app/outbox/contracts/__mocks__/outbox.service.mock';
import mockFxLotCostBasisService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-cost-basis-persistence.service.mock';
import mockFxLotAppService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-lot.service.mock';
import {
  TFxLotAcquisitionAppResult,
  TFxLotDispositionAppResult,
} from '@app/subledger/fx-cost-basis/types/fx-lot.service.types';

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
  const newBankCounterpartyResponse: ICounterpartyFindOrCreateRes = {
    new: true,
    data: bankCounterparty,
  };
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
      counterpartyAppService: mockCounterpartyAppService,
      fileManagementService: mockFileManagementService,
      journalEntryService: mockJournalEntryService,
      ledgerAccountRepo: mockLedgerAccountRepo,
      counterpartyRepo: mockCounterpartyRepo,
      journalEntryPersistenceService: mockJournalEntryPersistenceService,
      repoService: mockRepoService,
      eventBus: mockEventBus,
      outboxService: mockOutboxService,
      ledgerBalanceAdjustmentQueue: mockLedgerAccountBalanceAdjustmentQueue,
      fxLotAppService: mockFxLotAppService,
      fxCostBasisPersistenceService: mockFxLotCostBasisService.persistence,
    });
  }

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
      if (id === sourceAccount.id) return sourceAccount;
      if (id === destinationAccount.id) return destinationAccount;
      if (id === usdSourceAccount.id) return usdSourceAccount;
      if (id === usdDestinationAccount.id) return usdDestinationAccount;
      if (id === bankChargeAccount.id) return bankChargeAccount;
      return null;
    });
    mockFileManagementService.claimUploads.mockResolvedValue(attachments);
    mockCounterpartyAppService.findOrCreateMany.mockResolvedValue(new Map());
    mockJournalEntryService.createTransfer.mockResolvedValue({
      journalEntry: postedJournalEntry,
      destinationAssetAccount: destinationAccount,
    });
    mockRepoService.runInTransaction.mockImplementation(async (transactionFn) =>
      transactionFn('mock-tx' as unknown as ITransactionContext)
    );
    mockJournalEntryPersistenceService.create.mockResolvedValue();
    mockCounterpartyRepo.create.mockResolvedValue();
    mockOutboxService.createBalancePropagation.mockResolvedValue();
    mockLedgerAccountBalanceAdjustmentQueue.add.mockResolvedValue();
    mockEventBus.publish.mockResolvedValue();
    mockFxLotAppService.dispose.mockResolvedValue(null);
    mockFxLotAppService.acquire.mockResolvedValue(null);
    mockFxLotCostBasisService.persistence.persistDisposition.mockResolvedValue();
    mockFxLotCostBasisService.persistence.persistAcquisition.mockResolvedValue();
  });

  it('does not persist when journal creation rejects an archived account', async () => {
    const failure = new journalEntryError.ArchivedLedgerAccountNotAllowed();
    mockJournalEntryService.createTransfer.mockRejectedValueOnce(failure);
    await expect(getUseCase()(makePayload())).rejects.toBe(failure);
    expect(mockJournalEntryPersistenceService.create).not.toHaveBeenCalled();
    expect(mockOutboxService.createBalancePropagation).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

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
    expect(mockFileManagementService.claimUploads).toHaveBeenCalledWith({
      userId: user.id,
      purpose: EFileUploadPurpose.JournalEntryAttachment,
      references: payload.attachmentReferences,
    });
    expect(mockJournalEntryService.createTransfer).toHaveBeenCalledWith(
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
    expect(mockJournalEntryPersistenceService.create).toHaveBeenCalledWith(
      postedJournalEntry[0],
      expect.any(Object),
      expect.any(Array),
      { correlationId, tx: 'mock-tx' }
    );
    expect(mockOutboxService.createBalancePropagation).toHaveBeenCalledWith(
      postedJournalEntry[0].id,
      { correlationId, tx: 'mock-tx' }
    );
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).toHaveBeenCalledWith({
      journalEntryId: postedJournalEntry[0].id,
      correlationId,
    });
    expect(mockFxLotAppService.dispose).toHaveBeenCalledWith(
      {
        journalEntry: postedJournalEntry[0],
        account: sourceAccount,
        actor: actor.id,
      },
      { correlationId, idempotencyKey }
    );
    expect(mockFxLotAppService.acquire).toHaveBeenCalledWith(
      {
        journalEntry: postedJournalEntry[0],
        account: destinationAccount,
        actor: actor.id,
      },
      { correlationId, idempotencyKey }
    );
    expect(
      mockFxLotCostBasisService.persistence.persistDisposition
    ).not.toHaveBeenCalled();
    expect(
      mockFxLotCostBasisService.persistence.persistAcquisition
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
        counterparty: { name: 'Transfer provider' },
        amount: { amount: 50, currencyCode: 'NGN', isMinorUnit: true },
        exchangeRate: null,
        description: 'Transfer fee',
        sequenceOrder: 3,
      },
      {
        accountId: bankChargeAccount.id,
        counterparty: null,
        amount: { amount: 50, currencyCode: 'NGN', isMinorUnit: true },
        exchangeRate: null,
        description: 'Bank fee',
        sequenceOrder: 4,
      },
    ];
    mockCounterpartyAppService.findOrCreateMany.mockResolvedValueOnce(
      new Map([['transfer-provider', newBankCounterpartyResponse]])
    );
    mockCounterpartyAppService.getFoundOrCreated.mockReturnValueOnce(
      newBankCounterpartyResponse
    );

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
    expect(mockCounterpartyAppService.findOrCreateMany).toHaveBeenCalledWith(
      [payload.chargeLines[0].counterparty],
      accountingEntity.id,
      'a1111111-1111-4111-8111-111111111111' as TEntityId,
      'active',
      { correlationId, idempotencyKey }
    );
    expect(mockJournalEntryService.createTransfer).toHaveBeenCalledWith(
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
    expect(mockCounterpartyRepo.create).toHaveBeenCalledWith(
      bankCounterparty[0],
      expect.objectContaining({ correlationId, tx: 'mock-tx' })
    );
    expect(
      mockCounterpartyRepo.create.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mockJournalEntryPersistenceService.create.mock.invocationCallOrder[0]
    );
    expect(mockFxLotAppService.acquire).toHaveBeenCalledTimes(1);
    expect(mockFxLotAppService.acquire).toHaveBeenCalledWith(
      expect.objectContaining({ account: destinationAccount }),
      { correlationId, idempotencyKey }
    );
    expect(mockFxLotAppService.acquire).not.toHaveBeenCalledWith(
      expect.objectContaining({ account: bankChargeAccount }),
      expect.anything()
    );
    const [publishedEvents] = mockEventBus.publish.mock.calls[0];
    expect(publishedEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: bankCounterparty[1][0].type }),
      ])
    );
  });

  it('maps unresolved charge counterparties as null with their exchange rate', async () => {
    const payload = makePayload();
    payload.chargeLines = [
      {
        accountId: bankChargeAccount.id,
        counterparty: { name: 'Transfer provider' },
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
    mockCounterpartyAppService.getFoundOrCreated.mockReturnValueOnce(undefined);

    await getUseCase()(payload);

    expect(mockJournalEntryService.createTransfer).toHaveBeenCalledWith(
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
        counterparty: { name: 'Transfer provider' },
        amount: { amount: 50, currencyCode: 'NGN', isMinorUnit: true },
        exchangeRate: null,
        description: 'Transfer fee',
        sequenceOrder: 3,
      },
    ];
    const existingBankCounterpartyResponse: ICounterpartyFindOrCreateRes = {
      new: false,
      data: bankCounterparty,
    };
    mockCounterpartyAppService.findOrCreateMany.mockResolvedValueOnce(
      new Map([['transfer-provider', existingBankCounterpartyResponse]])
    );
    mockCounterpartyAppService.getFoundOrCreated.mockReturnValueOnce(
      existingBankCounterpartyResponse
    );

    await getUseCase()(payload);

    expect(mockJournalEntryService.createTransfer).toHaveBeenCalledWith(
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
    mockJournalEntryService.createTransfer.mockResolvedValue({
      journalEntry: draftJournalEntry,
      destinationAssetAccount: destinationAccount,
    });

    await getUseCase()(payload);

    expect(mockJournalEntryPersistenceService.create).toHaveBeenCalledTimes(1);
    expect(mockOutboxService.createBalancePropagation).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
    expect(mockFxLotAppService.dispose).toHaveBeenCalledTimes(1);
    expect(mockFxLotAppService.acquire).toHaveBeenCalledTimes(1);
    expect(
      mockFxLotCostBasisService.persistence.persistDisposition
    ).not.toHaveBeenCalled();
    expect(
      mockFxLotCostBasisService.persistence.persistAcquisition
    ).not.toHaveBeenCalled();
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    expect(mockCounterpartyAppService.findOrCreateMany.mock.calls[0][3]).toBe(
      'draft'
    );
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

    expect(mockJournalEntryService.createTransfer).toHaveBeenCalledWith(
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

    expect(mockFileManagementService.claimUploads).toHaveBeenCalledWith(
      expect.objectContaining({ references: [] })
    );
  });

  it('rejects a missing source account before claiming uploads', async () => {
    mockLedgerAccountRepo.findById.mockResolvedValueOnce(null);

    const payload = makePayload();

    await expect(getUseCase()(payload)).rejects.toMatchObject({
      cause: { id: payload.sourceLine.accountId },
    });
    expect(mockFileManagementService.claimUploads).not.toHaveBeenCalled();
    expect(mockJournalEntryService.createTransfer).not.toHaveBeenCalled();
  });

  it('rejects a missing destination account before claiming uploads', async () => {
    mockLedgerAccountRepo.findById
      .mockResolvedValueOnce(sourceAccount)
      .mockResolvedValueOnce(null);

    const payload = makePayload();

    await expect(getUseCase()(payload)).rejects.toMatchObject({
      cause: { id: payload.destinationLine.accountId },
    });
    expect(mockFileManagementService.claimUploads).not.toHaveBeenCalled();
    expect(mockJournalEntryService.createTransfer).not.toHaveBeenCalled();
  });

  it('rejects the exact missing charge account before resolving counterparties', async () => {
    const payload = makePayload();
    payload.chargeLines = [
      {
        accountId: bankChargeAccount.id,
        counterparty: null,
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
    expect(mockCounterpartyAppService.findOrCreateMany).not.toHaveBeenCalled();
    expect(mockFileManagementService.claimUploads).not.toHaveBeenCalled();
    expect(mockJournalEntryService.createTransfer).not.toHaveBeenCalled();
  });

  it('prevents domain creation and persistence when attachment claiming fails', async () => {
    mockFileManagementService.claimUploads.mockRejectedValueOnce(
      new fileAppError.InvalidUploadReference()
    );

    await expect(getUseCase()(makePayload())).rejects.toThrow(
      fileAppError.InvalidUploadReference
    );
    expect(mockJournalEntryService.createTransfer).not.toHaveBeenCalled();
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('prevents persistence when domain creation fails', async () => {
    mockJournalEntryService.createTransfer.mockRejectedValueOnce(
      new Error('domain failure')
    );

    await expect(getUseCase()(makePayload())).rejects.toThrow('domain failure');
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it.each([
    ['account', journalEntryError.DraftLedgerAccountNotAllowed],
    ['counterparty', journalEntryError.DraftCounterpartyNotAllowed],
  ] as const)(
    'stops before journal, FX, and propagation writes when a draft %s blocks posting',
    async (_, ErrorType) => {
      const error = new ErrorType();
      mockJournalEntryService.createTransfer.mockRejectedValueOnce(error);

      await expect(getUseCase()(makePayload())).rejects.toBe(error);

      expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
      expect(mockCounterpartyRepo.create).not.toHaveBeenCalled();
      expect(mockJournalEntryPersistenceService.create).not.toHaveBeenCalled();
      expect(mockFxLotAppService.dispose).not.toHaveBeenCalled();
      expect(mockFxLotAppService.acquire).not.toHaveBeenCalled();
      expect(
        mockFxLotCostBasisService.persistence.persistDisposition
      ).not.toHaveBeenCalled();
      expect(
        mockFxLotCostBasisService.persistence.persistAcquisition
      ).not.toHaveBeenCalled();
      expect(mockOutboxService.createBalancePropagation).not.toHaveBeenCalled();
      expect(
        mockLedgerAccountBalanceAdjustmentQueue.add
      ).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );

  it('does not run post-commit effects when the transaction fails', async () => {
    mockRepoService.runInTransaction.mockRejectedValueOnce(
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
    mockJournalEntryService.createTransfer.mockResolvedValueOnce({
      journalEntry: foreignJournalEntry,
      destinationAssetAccount: usdDestinationAccount,
    });
    const dispositionRecords = {
      missingOfficialRateOutbox: null,
    } as unknown as TFxLotDispositionAppResult['records'];
    const acquisitionRecords = {
      missingOfficialRateOutbox: null,
    } as unknown as TFxLotAcquisitionAppResult['records'];
    const dispositionEvent = {
      type: 'domain:fx-lot:disposed',
      data: { accountId: sourceAccount.id },
      occurredAt: effectiveDate,
      enrichedAt: null,
    };
    const acquisitionEvent = {
      type: 'domain:fx-lot:acquired',
      data: { accountId: destinationAccount.id },
      occurredAt: effectiveDate,
      enrichedAt: null,
    };
    mockFxLotAppService.dispose.mockResolvedValueOnce({
      records: dispositionRecords,
      events: [dispositionEvent],
    });
    mockFxLotAppService.acquire.mockResolvedValueOnce({
      records: acquisitionRecords,
      events: [acquisitionEvent],
    });

    await getUseCase()(payload);

    const writeOptions = { correlationId, tx: 'mock-tx' };
    expect(mockFxLotAppService.dispose).toHaveBeenCalledWith(
      {
        journalEntry: foreignJournalEntry[0],
        account: usdSourceAccount,
        actor: actor.id,
      },
      { correlationId, idempotencyKey }
    );
    expect(mockFxLotAppService.acquire).toHaveBeenCalledWith(
      {
        journalEntry: foreignJournalEntry[0],
        account: usdDestinationAccount,
        actor: actor.id,
      },
      { correlationId, idempotencyKey }
    );
    expect(
      mockFxLotCostBasisService.persistence.persistDisposition
    ).toHaveBeenCalledWith(dispositionRecords, writeOptions);
    expect(
      mockFxLotCostBasisService.persistence.persistAcquisition
    ).toHaveBeenCalledWith(acquisitionRecords, writeOptions);
    expect(
      mockJournalEntryPersistenceService.create.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mockFxLotCostBasisService.persistence.persistDisposition.mock
        .invocationCallOrder[0]
    );
    expect(
      mockFxLotCostBasisService.persistence.persistDisposition.mock
        .invocationCallOrder[0]
    ).toBeLessThan(
      mockFxLotCostBasisService.persistence.persistAcquisition.mock
        .invocationCallOrder[0]
    );
    expect(
      mockFxLotCostBasisService.persistence.persistAcquisition.mock
        .invocationCallOrder[0]
    ).toBeLessThan(
      mockOutboxService.createBalancePropagation.mock.invocationCallOrder[0]
    );
    const [publishedEvents] = mockEventBus.publish.mock.calls[0];
    expect(Array.isArray(publishedEvents)).toBe(true);
    if (!Array.isArray(publishedEvents)) {
      throw new Error('Expected transfer events to be published as an array');
    }
    expect(publishedEvents.slice(-2)).toEqual([
      expect.objectContaining({ type: dispositionEvent.type }),
      expect.objectContaining({ type: acquisitionEvent.type }),
    ]);
  });

  it('persists only a source disposition when acquisition preparation returns null', async () => {
    const records = {
      missingOfficialRateOutbox: null,
    } as unknown as TFxLotDispositionAppResult['records'];
    mockFxLotAppService.dispose.mockResolvedValueOnce({ records, events: [] });

    await getUseCase()(makePayload());

    expect(
      mockFxLotCostBasisService.persistence.persistDisposition
    ).toHaveBeenCalledWith(records, { correlationId, tx: 'mock-tx' });
    expect(
      mockFxLotCostBasisService.persistence.persistAcquisition
    ).not.toHaveBeenCalled();
  });

  it('persists only a destination acquisition when disposition preparation returns null', async () => {
    const records = {
      missingOfficialRateOutbox: null,
    } as unknown as TFxLotAcquisitionAppResult['records'];
    mockFxLotAppService.acquire.mockResolvedValueOnce({ records, events: [] });

    await getUseCase()(makePayload());

    expect(
      mockFxLotCostBasisService.persistence.persistDisposition
    ).not.toHaveBeenCalled();
    expect(
      mockFxLotCostBasisService.persistence.persistAcquisition
    ).toHaveBeenCalledWith(records, { correlationId, tx: 'mock-tx' });
  });

  it('prevents persistence when disposition preparation fails', async () => {
    const failure = new Error('FX disposition failed');
    mockFxLotAppService.dispose.mockRejectedValueOnce(failure);

    await expect(getUseCase()(makePayload())).rejects.toBe(failure);

    expect(mockFxLotAppService.acquire).not.toHaveBeenCalled();
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('prevents persistence when acquisition preparation fails', async () => {
    const failure = new Error('FX acquisition failed');
    mockFxLotAppService.acquire.mockRejectedValueOnce(failure);

    await expect(getUseCase()(makePayload())).rejects.toBe(failure);

    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('does not run post-commit effects when FX persistence fails', async () => {
    const records = {
      missingOfficialRateOutbox: null,
    } as unknown as TFxLotDispositionAppResult['records'];
    mockFxLotAppService.dispose.mockResolvedValueOnce({ records, events: [] });
    mockFxLotCostBasisService.persistence.persistDisposition.mockRejectedValueOnce(
      new Error('FX persistence failed')
    );

    await expect(getUseCase()(makePayload())).rejects.toThrow(
      'FX persistence failed'
    );

    expect(mockOutboxService.createBalancePropagation).not.toHaveBeenCalled();
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
});
