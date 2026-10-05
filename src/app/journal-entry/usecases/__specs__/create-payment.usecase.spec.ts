import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService from '@shared/contracts/__mocks__/repo.mock';
import { ITransactionContext } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import { EAccountingEntityType } from '@domain/accounting/types/accounting-entity.types';
import makeCounterpartyService from '@domain/counterparty/services/counterparty.service';
import { ECounterpartyType } from '@domain/counterparty/types/counterparty.types';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import getLedgerAccountNormalBalance from '@domain/ledger/entities/helpers/get-normal-balance.helper';
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
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';
import {
  ELiabilityAccountBehavior,
  ELiabilitySubType,
} from '@domain/ledger/types/liability-account.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
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
import { mockJournalLineRepo } from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';
import journalEntryDtoMapper from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.mapper';
import { IPaymentEntryReq } from '@app/journal-entry/dtos/payment-entry/payment-entry.dto';
import makeCreatePaymentUsecase from '@app/journal-entry/usecases/create-payment.usecase';
import mockLedgerAccountBalanceAdjustmentQueue from '@app/ledger/contracts/__mocks__/ledger-balance-adjustment-queue.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import mockOutboxService from '@app/outbox/contracts/__mocks__/outbox.service.mock';
import mockFxLotCostBasisService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-cost-basis-persistence.service.mock';
import mockFxLotAppService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-lot.service.mock';
import { TFxLotDispositionAppResult } from '@app/subledger/fx-cost-basis/types/fx-lot.service.types';

const actor = {
  ...actorEntity.makeUser({
    email: 'actor@example.com',
    displayName: 'Actor',
  })[0],
  id: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
};

describe('makeCreatePaymentUsecase', () => {
  const correlationId = 'payment-correlation-id';
  const idempotencyKey = 'payment-idempotency-key';
  const user: IUser = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    actorId: 'b2222222-2222-4222-8222-222222222222' as TEntityId,
    id: generateUUID(),
    version: 1,
    email: 'payment@example.com',
    emailVerified: true,
    firstName: 'Payment',
    lastName: 'Maker',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
  const [accountingEntity] = accountingEntityEntity.make({
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    name: 'Payment Entity',
    ownerId: user.id,
    type: EAccountingEntityType.Individual,
    functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
    jurisdictionCode: 'NG',
  });

  function makeAccount(overrides: Partial<ILedgerAccount>) {
    const type = overrides.type ?? ELedgerType.Asset;
    const code = overrides.code ?? '100001';
    const [account] = ledgerAccountEntity.make({
      code,
      materializedPath: code,
      accountingEntityId: accountingEntity.id,
      type,
      subType: overrides.subType ?? EAssetSubType.CashAndCashEquivalent,
      behavior: overrides.behavior ?? EAssetAccountBehavior.Bank,
      normalBalance: getLedgerAccountNormalBalance(type),
      isControlAccount: false,
      controlAccountId: null,
      name: overrides.name ?? 'Payment account',
      currency: SYSTEM_CURRENCIES.NGN,
      status: ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
      meta: {},
      createdBy: actor.id,
      ...overrides,
    });

    return account;
  }

  const sourceAccount = makeAccount({ code: '100001' });
  const rentAccount = makeAccount({
    behavior: EExpenseAccountBehavior.RentAndUtilities,
    code: '502001',
    subType: EExpenseSubType.RentAndUtilities,
    type: ELedgerType.Expense,
  });
  const payableAccount = makeAccount({
    behavior: ELiabilityAccountBehavior.TradePayable,
    code: '201001',
    subType: ELiabilitySubType.Payable,
    type: ELedgerType.Liability,
  });

  const counterpartyService = makeCounterpartyService({
    journalLineRepo: mockJournalLineRepo,
  });
  const newCounterparty = counterpartyService.create({
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    accountingEntityId: accountingEntity.id,
    name: 'Payment Vendor',
    type: ECounterpartyType.Organization,
  });
  const existingCounterparty = counterpartyService.create({
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    accountingEntityId: accountingEntity.id,
    name: 'Existing Vendor',
    type: ECounterpartyType.Organization,
  });
  const newCounterpartyResponse: ICounterpartyFindOrCreateRes = {
    new: true,
    data: newCounterparty,
  };
  const existingCounterpartyResponse: ICounterpartyFindOrCreateRes = {
    new: false,
    data: existingCounterparty,
  };

  const [postedJournalEntry, postedEvents, postedAudit] =
    journalEntryEntity.make({
      accountingEntityId: accountingEntity.id,
      sourceType: EJournalEntrySourceType.Payment,
      effectiveDate: new Date('2026-08-30T00:00:00.000Z'),
      postedAt: new Date('2026-08-30T00:00:00.000Z'),
      memo: 'Payment',
      createdBy: actor.id,
      functionalCurrency: SYSTEM_CURRENCIES.NGN,
      lines: [
        {
          accountId: sourceAccount.id,
          counterpartyId: newCounterparty[0].id,
          sequenceOrder: 1,
          amount: { amount: 1000n, currency: SYSTEM_CURRENCIES.NGN },
          exchangeRate: null,
          side: EJournalSide.Credit,
          description: 'Bank payment',
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
        {
          accountId: rentAccount.id,
          counterpartyId: newCounterparty[0].id,
          sequenceOrder: 2,
          amount: { amount: 700n, currency: SYSTEM_CURRENCIES.NGN },
          exchangeRate: null,
          side: EJournalSide.Debit,
          description: 'Rent',
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
        {
          accountId: payableAccount.id,
          counterpartyId: newCounterparty[0].id,
          sequenceOrder: 3,
          amount: { amount: 300n, currency: SYSTEM_CURRENCIES.NGN },
          exchangeRate: null,
          side: EJournalSide.Debit,
          description: 'Payable',
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
      ],
    });

  function makePayload(): IPaymentEntryReq {
    return {
      sourceLine: {
        accountId: sourceAccount.id,
        counterparty: { name: 'Payment Vendor' },
        amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
        exchangeRate: null,
        description: 'Bank payment',
        sequenceOrder: 1,
      },
      destinationLines: [
        {
          accountId: rentAccount.id,
          counterparty: { name: 'Payment Vendor' },
          amount: { amount: 700, currencyCode: 'NGN', isMinorUnit: true },
          exchangeRate: null,
          description: 'Rent',
          sequenceOrder: 2,
        },
        {
          accountId: payableAccount.id,
          counterparty: { name: 'Payment Vendor' },
          amount: { amount: 300, currencyCode: 'NGN', isMinorUnit: true },
          exchangeRate: null,
          description: 'Payable',
          sequenceOrder: 3,
        },
      ],
      effectiveDate: new Date('2026-08-30T00:00:00.000Z'),
      postedAt: new Date('2026-08-30T00:00:00.000Z'),
      memo: 'Payment',
    };
  }

  function getUseCase() {
    return makeCreatePaymentUsecase({
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
    mockFxLotAppService.dispose.mockResolvedValue(null);
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
      if (id === rentAccount.id) return rentAccount;
      if (id === payableAccount.id) return payableAccount;
      return null;
    });
    mockCounterpartyAppService.findOrCreateMany.mockResolvedValue(
      new Map([['vendor', newCounterpartyResponse]])
    );
    mockCounterpartyAppService.getFoundOrCreated.mockReturnValue(
      newCounterpartyResponse
    );
    mockFileManagementService.claimUploads.mockResolvedValue([]);
    mockJournalEntryService.createPayment.mockResolvedValue([
      postedJournalEntry,
      postedEvents,
      postedAudit,
    ]);
    mockRepoService.runInTransaction.mockImplementation(async (transactionFn) =>
      transactionFn('mock-tx' as unknown as ITransactionContext)
    );
    mockOutboxService.createBalancePropagation.mockResolvedValue();
    mockLedgerAccountBalanceAdjustmentQueue.add.mockResolvedValue();
    mockEventBus.publish.mockResolvedValue();
  });

  it('does not persist when journal creation rejects an archived account', async () => {
    const failure = new journalEntryError.ArchivedLedgerAccountNotAllowed();
    mockJournalEntryService.createPayment.mockRejectedValueOnce(failure);
    await expect(getUseCase()(makePayload())).rejects.toBe(failure);
    expect(mockJournalEntryPersistenceService.create).not.toHaveBeenCalled();
    expect(mockOutboxService.createBalancePropagation).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('orchestrates a posted payment and returns its DTO', async () => {
    const payload = makePayload();
    const attachmentReferences = ['123e4567-e89b-12d3-a456-426614174010'];
    const attachments = [
      {
        url: 'https://files.example.com/payment.pdf',
        name: 'payment.pdf',
        type: 'application/pdf',
        size: 2048,
      },
    ];
    payload.attachmentReferences = attachmentReferences;
    payload.sourceLine.exchangeRate = {
      baseCurrencyCode: 'NGN',
      targetCurrencyCode: 'NGN',
      rate: 1,
      type: 'official',
      asOf: payload.effectiveDate,
      source: 'test-source',
    };
    payload.destinationLines[0].exchangeRate = {
      baseCurrencyCode: 'NGN',
      targetCurrencyCode: 'NGN',
      rate: 1,
      type: 'official',
      asOf: payload.effectiveDate,
      source: 'test-source',
    };
    mockFileManagementService.claimUploads.mockResolvedValue(attachments);
    const lotId = generateUUID();
    const dispositionId = generateUUID();
    const fxRecords = {
      lots: [{ lot: { id: lotId }, history: { entityId: lotId } }],
      disposition: {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: dispositionId,
        officialRate: null,
      },
      dispositionHistory: {
        actorId: 'b2222222-2222-4222-8222-222222222222' as TEntityId,
        onBehalfOf: null,
        entityId: dispositionId,
      },
      allocations: [],
      missingOfficialRateOutbox: null,
    } as unknown as TFxLotDispositionAppResult['records'];
    const fxResult: TFxLotDispositionAppResult = {
      records: fxRecords,
      events: [],
    };
    mockFxLotAppService.dispose.mockResolvedValueOnce(fxResult);

    const result = await getUseCase()(payload);
    const repoOptions = { correlationId, idempotencyKey };

    expect(mockFxLotAppService.dispose).toHaveBeenCalledWith(
      {
        journalEntry: postedJournalEntry,
        account: sourceAccount,
        actor: actor.id,
      },
      { correlationId }
    );
    expect(
      mockFxLotCostBasisService.persistence.persistDisposition
    ).toHaveBeenCalledWith(
      fxRecords,
      expect.objectContaining({ correlationId, tx: 'mock-tx' })
    );
    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledTimes(3);
    expect(mockCounterpartyAppService.findOrCreateMany).toHaveBeenCalledWith(
      [
        payload.sourceLine.counterparty,
        payload.destinationLines[0].counterparty,
        payload.destinationLines[1].counterparty,
      ],
      accountingEntity.id,
      'a1111111-1111-4111-8111-111111111111' as TEntityId,
      'active',
      repoOptions
    );
    expect(mockFileManagementService.claimUploads).toHaveBeenCalledWith({
      userId: user.id,
      purpose: EFileUploadPurpose.JournalEntryAttachment,
      references: attachmentReferences,
    });
    expect(mockJournalEntryService.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments,
        sourceLine: expect.objectContaining({
          account: sourceAccount,
          counterparty: newCounterparty[0],
          exchangeRate: expect.any(Object),
        }),
        destinationLines: [
          expect.objectContaining({
            account: rentAccount,
            exchangeRate: expect.any(Object),
          }),
          expect.objectContaining({
            account: payableAccount,
            exchangeRate: null,
          }),
        ],
      }),
      repoOptions
    );
    expect(mockCounterpartyRepo.create).toHaveBeenCalled();
    expect(mockCounterpartyRepo.create).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        correlationId,
        history: expect.any(Object),
        tx: 'mock-tx',
      })
    );
    expect(mockJournalEntryPersistenceService.create).toHaveBeenCalled();
    expect(mockOutboxService.createBalancePropagation).toHaveBeenCalledWith(
      postedJournalEntry.id,
      expect.objectContaining({ correlationId, tx: expect.anything() })
    );
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).toHaveBeenCalledWith({
      journalEntryId: postedJournalEntry.id,
      correlationId,
    });
    expect(mockEventBus.publish).toHaveBeenCalled();
    expect(result).toEqual(journalEntryDtoMapper.toDto(postedJournalEntry));
  });

  it('prevents persistence when FX disposition preparation fails', async () => {
    const failure = new Error('FX disposition failed');
    mockFxLotAppService.dispose.mockRejectedValueOnce(failure);

    await expect(getUseCase()(makePayload())).rejects.toBe(failure);

    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
    expect(mockJournalEntryPersistenceService.create).not.toHaveBeenCalled();
    expect(mockOutboxService.createBalancePropagation).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('persists a draft without balance propagation or new counterparties', async () => {
    const payload = makePayload();
    payload.postedAt = null;
    const draftJournalEntry = {
      ...postedJournalEntry,
      status: EJournalEntryStatus.Draft,
      postedAt: null,
    };
    mockCounterpartyAppService.findOrCreateMany.mockResolvedValue(
      new Map([['vendor', existingCounterpartyResponse]])
    );
    mockCounterpartyAppService.getFoundOrCreated.mockReturnValue(
      existingCounterpartyResponse
    );
    mockJournalEntryService.createPayment.mockResolvedValue([
      draftJournalEntry,
      postedEvents,
      postedAudit,
    ]);

    await getUseCase()(payload);

    expect(mockFxLotAppService.dispose).toHaveBeenCalledWith(
      {
        journalEntry: draftJournalEntry,
        account: sourceAccount,
        actor: actor.id,
      },
      { correlationId }
    );
    expect(mockFileManagementService.claimUploads).toHaveBeenCalledWith(
      expect.objectContaining({ references: [] })
    );
    expect(mockCounterpartyRepo.create).not.toHaveBeenCalled();
    expect(mockJournalEntryPersistenceService.create).toHaveBeenCalled();
    expect(mockOutboxService.createBalancePropagation).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
    expect(mockCounterpartyAppService.findOrCreateMany.mock.calls[0][3]).toBe(
      'draft'
    );
  });

  it('passes unresolved counterparties to the domain as null', async () => {
    mockCounterpartyAppService.getFoundOrCreated.mockReturnValue(undefined);

    await getUseCase()(makePayload());

    expect(mockJournalEntryService.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLine: expect.objectContaining({ counterparty: null }),
        destinationLines: expect.arrayContaining([
          expect.objectContaining({ counterparty: null }),
        ]),
      }),
      expect.any(Object)
    );
  });

  it('rejects a missing source account before resolving counterparties', async () => {
    mockLedgerAccountRepo.findById.mockResolvedValue(null);

    await expect(getUseCase()(makePayload())).rejects.toThrow(
      ledgerAppError.AccountNotFound
    );

    expect(mockCounterpartyAppService.findOrCreateMany).not.toHaveBeenCalled();
    expect(mockJournalEntryService.createPayment).not.toHaveBeenCalled();
  });

  it('rejects a missing destination account before resolving counterparties', async () => {
    mockLedgerAccountRepo.findById.mockImplementation(async (id: TEntityId) =>
      id === sourceAccount.id ? sourceAccount : null
    );

    await expect(getUseCase()(makePayload())).rejects.toThrow(
      ledgerAppError.AccountNotFound
    );

    expect(mockCounterpartyAppService.findOrCreateMany).not.toHaveBeenCalled();
    expect(mockJournalEntryService.createPayment).not.toHaveBeenCalled();
  });

  it('prevents persistence when attachment claiming fails', async () => {
    const error = new fileAppError.InvalidUploadReference();
    mockFileManagementService.claimUploads.mockRejectedValue(error);

    await expect(getUseCase()(makePayload())).rejects.toBe(error);

    expect(mockJournalEntryService.createPayment).not.toHaveBeenCalled();
    expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('prevents persistence when domain creation fails', async () => {
    mockJournalEntryService.createPayment.mockRejectedValue(
      new ledgerAppError.AccountNotFound()
    );

    await expect(getUseCase()(makePayload())).rejects.toThrow(
      ledgerAppError.AccountNotFound
    );

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
      mockJournalEntryService.createPayment.mockRejectedValueOnce(error);

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

  it('rejects invalid input before reading request context', async () => {
    const payload = { ...makePayload(), destinationLines: [] };

    await expect(getUseCase()(payload)).rejects.toThrow();

    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockLedgerAccountRepo.findById).not.toHaveBeenCalled();
  });
});
