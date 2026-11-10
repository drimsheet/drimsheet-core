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
import getLedgerAccountNormalBalanceHelper from '@domain/ledger/entities/helpers/get-normal-balance.helper';
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
import { IAppContextData } from '@app/context/types/app-context.types';
import { mockCounterpartyRepo } from '@app/counterparty/contracts/__mocks__/counterparty.repos.mock';
import mockFileManagementAppService from '@app/file/contracts/__mocks__/file-management.service.mock';
import fileAppError from '@app/file/errors/file.error';
import { EFileUploadPurpose } from '@app/file/types/file.types';
import mockJournalEntryPersistenceAppService from '@app/journal-entry/contracts/__mocks__/journal-entry-persistence.service.mock';
import { mockPaymentEntryService } from '@app/journal-entry/contracts/__mocks__/journal-entry.domain.services.mock';
import { mockJournalLineRepo } from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';
import journalEntryDtoMapper from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.mapper';
import { IPaymentEntryReq } from '@app/journal-entry/dtos/payment-entry/payment-entry.dto';
import makeCreatePaymentUsecase from '@app/journal-entry/usecases/create-payment.usecase';
import mockLedgerAccountBalanceAdjustmentQueue from '@app/ledger/contracts/__mocks__/ledger-balance-adjustment-queue.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import mockExchangeRateAppService from '@app/money/contracts/__mocks__/exchange-rate.service.mock';
import { mockFxCostBasisLotService } from '@app/subledger/contracts/__mocks__/subledger.domain.services.mock';
import { makeFxDispositionResult } from '@app/subledger/fx-cost-basis/__fixtures__/fx-lot-results.fixture';
import mockFxLotCostBasisAppService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-cost-basis-persistence.service.mock';

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
      normalBalance: getLedgerAccountNormalBalanceHelper(type),
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
  const selectedCounterparty = counterpartyService.create({
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
          counterpartyId: selectedCounterparty[0].id,
          sequenceOrder: 1,
          amount: { amount: 1000n, currency: SYSTEM_CURRENCIES.NGN },
          exchangeRate: null,
          side: EJournalSide.Credit,
          description: 'Bank payment',
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
        {
          accountId: rentAccount.id,
          counterpartyId: existingCounterparty[0].id,
          sequenceOrder: 2,
          amount: { amount: 700n, currency: SYSTEM_CURRENCIES.NGN },
          exchangeRate: null,
          side: EJournalSide.Debit,
          description: 'Rent',
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
        {
          accountId: payableAccount.id,
          counterpartyId: selectedCounterparty[0].id,
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
        counterpartyId: selectedCounterparty[0].id,
        amount: { amount: 1000, currencyCode: 'NGN', isMinorUnit: true },
        exchangeRate: null,
        description: 'Bank payment',
        sequenceOrder: 1,
      },
      destinationLines: [
        {
          accountId: rentAccount.id,
          counterpartyId: existingCounterparty[0].id,
          amount: { amount: 700, currencyCode: 'NGN', isMinorUnit: true },
          exchangeRate: null,
          description: 'Rent',
          sequenceOrder: 2,
        },
        {
          accountId: payableAccount.id,
          counterpartyId: selectedCounterparty[0].id,
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
      counterpartyRepo: mockCounterpartyRepo,
      fileManagementAppService: mockFileManagementAppService,
      paymentEntryService: mockPaymentEntryService,
      ledgerAccountRepo: mockLedgerAccountRepo,
      journalEntryPersistenceAppService: mockJournalEntryPersistenceAppService,
      repoService: mockRepoService,
      eventBus: mockEventBus,
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
    mockFxCostBasisLotService.dispose.mockResolvedValue(null);
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
      if (id === rentAccount.id) {
        return rentAccount;
      }
      if (id === payableAccount.id) {
        return payableAccount;
      }
      return null;
    });
    mockCounterpartyRepo.findByIds.mockResolvedValue([
      selectedCounterparty[0],
      existingCounterparty[0],
    ]);
    mockFileManagementAppService.claimUploads.mockResolvedValue([]);
    mockPaymentEntryService.create.mockResolvedValue([
      postedJournalEntry,
      postedEvents,
      postedAudit,
    ]);
    mockRepoService.createTransaction
      .mockReset()
      .mockResolvedValue(mockRepoTransaction);
    mockRepoTransaction.commit.mockReset().mockResolvedValue();
    mockRepoTransaction.handleError
      .mockReset()
      .mockImplementation(async (error) => {
        throw error;
      });
    mockLedgerAccountBalanceAdjustmentQueue.add.mockResolvedValue();
    mockEventBus.publish.mockResolvedValue();
  });

  it.each([
    new journalEntryError.ArchivedLedgerAccountNotAllowed(),
    new periodError.PostingDateNotCovered(),
    new periodError.PostingPeriodAmbiguous(),
    new periodError.PostingPeriodNotOpen(),
  ])(
    'does not persist or publish when journal creation rejects: %s',
    async (failure) => {
      mockPaymentEntryService.create.mockRejectedValueOnce(failure);
      await expect(getUseCase()(makePayload())).rejects.toBe(failure);
      expect(
        mockJournalEntryPersistenceAppService.create
      ).not.toHaveBeenCalled();
      expect(
        mockLedgerAccountBalanceAdjustmentQueue.add
      ).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );

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
    mockFileManagementAppService.claimUploads.mockResolvedValue(attachments);
    const fxDisposition = makeFxDispositionResult(null);
    mockFxCostBasisLotService.dispose.mockResolvedValueOnce(fxDisposition);

    const result = await getUseCase()(payload);
    const repoOptions = { correlationId, idempotencyKey };

    expect(mockFxCostBasisLotService.dispose).toHaveBeenCalledWith(
      {
        journalEntry: postedJournalEntry,
        account: sourceAccount,
        createdBy: actor.id,
        officialRate: null,
      },
      { correlationId }
    );
    expect(
      mockFxLotCostBasisAppService.persistence.persistDisposition
    ).toHaveBeenCalledWith(
      fxDisposition,
      actor.id,
      expect.objectContaining({
        correlationId,
        tx: mockRepoTransaction.context,
      })
    );
    expect(mockLedgerAccountRepo.findById).toHaveBeenCalledTimes(3);
    expect(mockCounterpartyRepo.findByIds).toHaveBeenCalledWith(
      [
        payload.sourceLine.counterpartyId,
        payload.destinationLines[0].counterpartyId,
      ],
      accountingEntity.id,
      repoOptions
    );
    expect(mockFileManagementAppService.claimUploads).toHaveBeenCalledWith({
      userId: user.id,
      purpose: EFileUploadPurpose.JournalEntryAttachment,
      references: attachmentReferences,
    });
    expect(mockPaymentEntryService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments,
        sourceLine: expect.objectContaining({
          account: sourceAccount,
          counterparty: selectedCounterparty[0],
          exchangeRate: expect.any(Object),
        }),
        destinationLines: [
          expect.objectContaining({
            account: rentAccount,
            counterparty: existingCounterparty[0],
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
    expect(mockCounterpartyRepo.create).not.toHaveBeenCalled();
    expect(mockJournalEntryPersistenceAppService.create).toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).toHaveBeenCalledWith(
      correlationId,
      {
        journalEntryId: postedJournalEntry.id,
      }
    );
    expect(mockEventBus.publish).toHaveBeenCalled();
    expect(result).toEqual(journalEntryDtoMapper.toDto(postedJournalEntry));
  });

  it('prevents persistence when FX disposition preparation fails', async () => {
    const failure = new Error('FX disposition failed');
    mockFxCostBasisLotService.dispose.mockRejectedValueOnce(failure);

    await expect(getUseCase()(makePayload())).rejects.toBe(failure);

    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    expect(mockJournalEntryPersistenceAppService.create).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('persists a draft with existing counterparties and no balance propagation', async () => {
    const payload = makePayload();
    payload.postedAt = null;
    payload.sourceLine.counterpartyId = existingCounterparty[0].id;
    for (const line of payload.destinationLines) {
      line.counterpartyId = existingCounterparty[0].id;
    }
    const draftJournalEntry = {
      ...postedJournalEntry,
      status: EJournalEntryStatus.Draft,
      postedAt: null,
    };
    mockCounterpartyRepo.findByIds.mockResolvedValue([existingCounterparty[0]]);
    mockPaymentEntryService.create.mockResolvedValue([
      draftJournalEntry,
      postedEvents,
      postedAudit,
    ]);

    await getUseCase()(payload);

    expect(mockFxCostBasisLotService.dispose).not.toHaveBeenCalled();
    expect(mockFileManagementAppService.claimUploads).toHaveBeenCalledWith(
      expect.objectContaining({ references: [] })
    );
    expect(mockPaymentEntryService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLine: expect.objectContaining({
          counterparty: existingCounterparty[0],
        }),
      }),
      expect.any(Object)
    );
    expect(mockCounterpartyRepo.create).not.toHaveBeenCalled();
    expect(mockJournalEntryPersistenceAppService.create).toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
  });

  it('rejects a partially resolved counterparty batch before preparing the journal', async () => {
    mockCounterpartyRepo.findByIds.mockResolvedValueOnce([
      selectedCounterparty[0],
    ]);

    await expect(getUseCase()(makePayload())).rejects.toThrow(
      counterpartyError.InvalidCounterpartyId
    );

    expect(mockPaymentEntryService.create).not.toHaveBeenCalled();
    expect(mockFileManagementAppService.claimUploads).not.toHaveBeenCalled();
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('rejects a missing source account before resolving counterparties', async () => {
    mockLedgerAccountRepo.findById.mockResolvedValue(null);

    await expect(getUseCase()(makePayload())).rejects.toThrow(
      ledgerAppError.AccountNotFound
    );

    expect(mockCounterpartyRepo.findByIds).not.toHaveBeenCalled();
    expect(mockPaymentEntryService.create).not.toHaveBeenCalled();
  });

  it('rejects a missing destination account before resolving counterparties', async () => {
    mockLedgerAccountRepo.findById.mockImplementation(async (id: TEntityId) =>
      id === sourceAccount.id ? sourceAccount : null
    );

    await expect(getUseCase()(makePayload())).rejects.toThrow(
      ledgerAppError.AccountNotFound
    );

    expect(mockCounterpartyRepo.findByIds).not.toHaveBeenCalled();
    expect(mockPaymentEntryService.create).not.toHaveBeenCalled();
  });

  it('prevents persistence when attachment claiming fails', async () => {
    const error = new fileAppError.InvalidUploadReference();
    mockFileManagementAppService.claimUploads.mockRejectedValue(error);

    await expect(getUseCase()(makePayload())).rejects.toBe(error);

    expect(mockPaymentEntryService.create).not.toHaveBeenCalled();
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('prevents persistence when domain creation fails', async () => {
    mockPaymentEntryService.create.mockRejectedValue(
      new ledgerAppError.AccountNotFound()
    );

    await expect(getUseCase()(makePayload())).rejects.toThrow(
      ledgerAppError.AccountNotFound
    );

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
      mockPaymentEntryService.create.mockRejectedValueOnce(error);

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
  it('propagates counterparty read failures before journal preparation or persistence', async () => {
    const failure = new Error('counterparty read failed');
    mockCounterpartyRepo.findByIds.mockRejectedValueOnce(failure);

    await expect(getUseCase()(makePayload())).rejects.toBe(failure);

    expect(mockPaymentEntryService.create).not.toHaveBeenCalled();
    expect(mockFileManagementAppService.claimUploads).not.toHaveBeenCalled();
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it.each(['acquisition', 'persistence', 'commit'] as const)(
    'handles transaction %s failure without publishing or enqueueing',
    async (phase) => {
      const failure = new Error('transaction failed');
      const failures = {
        acquisition: mockRepoService.createTransaction,
        persistence: mockJournalEntryPersistenceAppService.create,
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
    expect(mockRepoTransaction.commit.mock.invocationCallOrder[0]).toBeLessThan(
      mockEventBus.publish.mock.invocationCallOrder[0]
    );
    expect(mockEventBus.publish.mock.invocationCallOrder[0]).toBeLessThan(
      mockLedgerAccountBalanceAdjustmentQueue.add.mock.invocationCallOrder[0]
    );
  });
});
