import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import { ERepoLock } from '@shared/types/repo.types';
import generateUUID from '@shared/utils/uuid-generator';
import { IFileAttachment } from '@shared/values/file-attachments/types/file-attachment.types';

import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import makeReceiptEntryService from '@domain/journal-entry/services/receipt-entry.service';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import { EExchangeRateType } from '@domain/money/types/exchange-rate.types';
import moneyValue from '@domain/money/values/money.vo';
import fxCostBasisLotEntity from '@domain/subledger/fx-cost-basis/entities/lot.entity';

import { mockAccountingPeriodService } from '@app/accounting/contracts/__mocks__/accounting.domain.services.mock';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/types/app-context.types';
import { mockCounterpartyRepo } from '@app/counterparty/contracts/__mocks__/counterparty.repos.mock';
import mockFileManagementAppService from '@app/file/contracts/__mocks__/file-management.service.mock';
import { EFileUploadPurpose } from '@app/file/types/file.types';
import mockJournalEntryPersistenceAppService from '@app/journal-entry/contracts/__mocks__/journal-entry-persistence.service.mock';
import { mockReceiptEntryService } from '@app/journal-entry/contracts/__mocks__/journal-entry.domain.services.mock';
import { mockJournalEntryRepo } from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';
import { IReceiptEntryReq } from '@app/journal-entry/dtos/receipt-entry/receipt-entry.dto';
import makeVoidAndReplaceReceiptUsecase from '@app/journal-entry/usecases/void-and-replace-receipt.usecase';
import mockLedgerBalanceAdjustmentQueue from '@app/ledger/contracts/__mocks__/ledger-balance-adjustment-queue.mock';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import mockExchangeRateAppService from '@app/money/contracts/__mocks__/exchange-rate.service.mock';
import { mockFxCostBasisLotService } from '@app/subledger/contracts/__mocks__/subledger.domain.services.mock';
import { makeFxAcquisitionResult } from '@app/subledger/fx-cost-basis/__fixtures__/fx-lot-results.fixture';
import mockFxCostBasisAppService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-cost-basis-persistence.service.mock';

const actorId = generateUUID();
const userId = generateUUID();
const accountingEntityId = generateUUID();
const effectiveDate = new Date('2026-09-01T00:00:00.000Z');
const replacementEffectiveDate = new Date('2026-09-03T00:00:00.000Z');
const [destinationAccount] = ledgerAccountEntity.make({
  code: '100001',
  materializedPath: '100000.100001',
  accountingEntityId,
  createdBy: actorId,
  name: 'Petty cash',
  type: 'asset',
  subType: 'cash_and_cash_equivalent',
  behavior: 'petty_cash',
  normalBalance: 'debit',
  isControlAccount: false,
  controlAccountId: generateUUID(),
  currency: SYSTEM_CURRENCIES.NGN,
  status: 'active',
  meta: null,
  openingBalanceDate: effectiveDate,
  contraAccountRule: 'contra_permitted',
  adjunctAccountRule: 'adjunct_permitted',
});
const [sourceAccount] = ledgerAccountEntity.make({
  ...destinationAccount,
  code: '300001',
  materializedPath: '300000.300001',
  name: 'Services',
  type: 'revenue',
  subType: 'services',
  behavior: 'services',
  normalBalance: 'credit',
  openingBalanceDate: null,
});
const [counterparty] = counterpartyEntity.make({
  accountingEntityId,
  createdBy: actorId,
  name: 'Customer',
  type: 'organization',
});
const repoOptions = {
  correlationId: 'receipt-replacement',
  idempotencyKey: '',
};
const transactionOptions = { ...repoOptions, tx: mockRepoTransaction.context };
const receiptEntryService = makeReceiptEntryService({
  accountingPeriodService: mockAccountingPeriodService,
  counterpartyRepo: mockCounterpartyRepo,
  ledgerAccountRepo: mockLedgerAccountRepo,
});
const deps = {
  appContext: mockAppContext,
  counterpartyRepo: mockCounterpartyRepo,
  fileManagementAppService: mockFileManagementAppService,
  ledgerAccountRepo: mockLedgerAccountRepo,
  journalEntryRepo: mockJournalEntryRepo,
  receiptEntryService,
  journalEntryPersistenceAppService: mockJournalEntryPersistenceAppService,
  fxCostBasisLotService: mockFxCostBasisLotService,
  exchangeRateAppService: mockExchangeRateAppService,
  fxCostBasisPersistenceAppService: mockFxCostBasisAppService.persistence,
  ledgerBalanceAdjustmentQueue: mockLedgerBalanceAdjustmentQueue,
  repoService: mockRepoService,
  eventBus: mockEventBus,
};
const usecase = makeVoidAndReplaceReceiptUsecase(deps);
const sourceLine = {
  accountId: sourceAccount.id,
  counterpartyId: counterparty.id,
  amount: { amount: 8000, currencyCode: 'NGN', isMinorUnit: true },
  exchangeRate: null,
  description: null,
  sequenceOrder: 1,
};
const payload: IReceiptEntryReq = {
  effectiveDate: replacementEffectiveDate,
  postedAt: replacementEffectiveDate,
  memo: 'Corrected customer receipt',
  sourceLines: [sourceLine],
  destinationLine: {
    ...sourceLine,
    accountId: destinationAccount.id,
    sequenceOrder: 2,
  },
};

async function makeOriginalReceipt(
  postedAt: Date | null,
  attachments: IFileAttachment[] = []
) {
  const line = {
    account: sourceAccount,
    counterparty,
    amount: moneyValue.make(10000n, SYSTEM_CURRENCIES.NGN, true),
    exchangeRate: null,
    description: null,
    meta: null,
    sequenceOrder: 1,
  };
  const [entry] = await receiptEntryService.create(
    {
      header: {
        accountingEntityId,
        effectiveDate,
        postedAt,
        memo: 'Customer receipt',
        functionalCurrencyCode: 'NGN',
        createdBy: actorId,
      },
      sourceLines: [line],
      destinationLine: {
        ...line,
        account: destinationAccount,
        sequenceOrder: 2,
      },
      attachments,
    },
    repoOptions
  );
  return entry;
}

describe('makeVoidAndReplaceReceiptUsecase', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      actor: { id: actorId },
      accountingEntity: {
        id: accountingEntityId,
        functionalCurrencyCode: 'NGN',
      },
      user: { id: userId },
      ...repoOptions,
    } as IAppContextData);
    mockCounterpartyRepo.findByIds.mockResolvedValue([counterparty]);
    mockFileManagementAppService.claimUploads.mockResolvedValue([]);
    mockLedgerAccountRepo.findAllByIds.mockResolvedValue([
      sourceAccount,
      destinationAccount,
    ]);
    mockRepoService.createTransaction.mockResolvedValue(mockRepoTransaction);
    mockRepoTransaction.handleError.mockImplementation(async (error) => {
      throw error;
    });
    mockFxCostBasisLotService.reverse.mockResolvedValue(null);
    mockFxCostBasisLotService.acquire.mockReturnValue(null);
  });

  it('persists the void, exact reversal, and replacement together before publishing', async () => {
    const original = await makeOriginalReceipt(effectiveDate);
    mockJournalEntryRepo.findById.mockResolvedValue(original);
    mockAccountingPeriodService.validatePostingPeriod.mockClear();

    const attachmentReference = generateUUID();
    const attachment = {
      url: 'https://files.example.com/corrected-receipt.pdf',
      name: 'corrected-receipt.pdf',
      type: 'application/pdf',
      size: 1024,
    };
    mockFileManagementAppService.claimUploads.mockResolvedValue([attachment]);
    const response = await usecase(original.id, {
      ...payload,
      attachmentReferences: [attachmentReference],
    });

    expect(mockFileManagementAppService.claimUploads).toHaveBeenCalledWith({
      userId,
      purpose: EFileUploadPurpose.JournalEntryAttachment,
      references: [attachmentReference],
    });

    const [[persistence, options]] =
      mockJournalEntryPersistenceAppService.rectify.mock.calls;
    const [reversal, replacement] = persistence.entriesToCreate;
    expect(options).toEqual(transactionOptions);
    expect(reversal.entry.sourceType).toBe('reversal');
    expect(reversal.entry.lines.map((line) => line.side)).toEqual([
      'debit',
      'credit',
    ]);
    expect(reversal.entry.lines.map((line) => line.amount)).toEqual(
      original.lines.map((line) => line.amount)
    );
    expect(persistence.entryUpdate).toMatchObject({
      expectedVersion: original.version,
      entry: {
        id: original.id,
        status: 'voided',
        voidingEntryId: reversal.entry.id,
      },
      headerHistory: { action: 'voided' },
    });
    expect(response).toMatchObject({
      id: replacement.entry.id,
      status: 'posted',
      memo: payload.memo,
    });
    expect(replacement.entry.effectiveDate).toEqual(replacementEffectiveDate);
    expect(replacement.entry.attachments).toEqual([attachment]);
    const lockedReadOptions = { ...transactionOptions, lock: ERepoLock.Share };
    expect(
      mockAccountingPeriodService.validatePostingPeriod.mock.calls
    ).toEqual([
      [accountingEntityId, reversal.entry.effectiveDate, lockedReadOptions],
      [accountingEntityId, replacementEffectiveDate, lockedReadOptions],
    ]);
    expect(replacement.entry.lines.map((line) => line.amount.amount)).toEqual([
      8000n,
      8000n,
    ]);
    expect(mockLedgerBalanceAdjustmentQueue.add.mock.calls).toEqual([
      [repoOptions.correlationId, { journalEntryId: reversal.entry.id }],
      [repoOptions.correlationId, { journalEntryId: replacement.entry.id }],
    ]);
    const [commitOrder] = mockRepoTransaction.commit.mock.invocationCallOrder;
    expect(commitOrder).toBeLessThan(
      mockEventBus.publish.mock.invocationCallOrder[0]
    );
    expect(commitOrder).toBeLessThan(
      mockLedgerBalanceAdjustmentQueue.add.mock.invocationCallOrder[0]
    );
  });

  it('commits a draft replacement and schedules balance processing for the reversal alone', async () => {
    const original = await makeOriginalReceipt(effectiveDate);
    mockJournalEntryRepo.findById.mockResolvedValue(original);

    const response = await usecase(original.id, { ...payload, postedAt: null });

    const [[persistence, options]] =
      mockJournalEntryPersistenceAppService.rectify.mock.calls;
    const [reversal, replacement] = persistence.entriesToCreate;
    expect(options).toEqual(transactionOptions);
    expect(persistence.entryUpdate?.entry.voidingEntryId).toBe(
      reversal.entry.id
    );
    expect(replacement.entry.status).toBe('draft');
    expect(response).toMatchObject({
      id: replacement.entry.id,
      status: 'draft',
      postedAt: null,
    });
    expect(mockFxCostBasisLotService.reverse).toHaveBeenCalledWith(
      original.id,
      repoOptions
    );
    expect(mockFxCostBasisLotService.acquire).not.toHaveBeenCalled();
    expect(mockLedgerBalanceAdjustmentQueue.add.mock.calls).toEqual([
      [repoOptions.correlationId, { journalEntryId: reversal.entry.id }],
    ]);
    expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])(
    'creates a replacement receipt without attachments, explicit empty list=%s',
    async (includeEmptyList) => {
      const attachment = {
        url: 'https://files.example.com/original-receipt.pdf',
        name: 'original-receipt.pdf',
        type: 'application/pdf',
        size: 1024,
      };
      const original = await makeOriginalReceipt(effectiveDate, [attachment]);
      mockJournalEntryRepo.findById.mockResolvedValue(original);

      const response = await usecase(original.id, {
        ...payload,
        ...(includeEmptyList ? { attachmentReferences: [] } : {}),
      });

      expect(response.attachments).toEqual([]);
      expect(mockFileManagementAppService.claimUploads).not.toHaveBeenCalled();
      const [[persistence]] =
        mockJournalEntryPersistenceAppService.rectify.mock.calls;
      expect(persistence.entryUpdate?.entry.attachments).toEqual([attachment]);
      expect(persistence.entriesToCreate[1].entry.attachments).toEqual(
        response.attachments
      );
    }
  );

  it('persists the original FX reversal and the replacement acquisition in the journal transaction', async () => {
    const original = await makeOriginalReceipt(effectiveDate);
    mockJournalEntryRepo.findById.mockResolvedValue(original);
    const originalAcquisition = makeFxAcquisitionResult();
    const [lot] = originalAcquisition.lot;
    const fxReversal = {
      lots: [
        fxCostBasisLotEntity.reverseAcquisition(
          lot,
          lot.originalQuantity,
          lot.costBasis
        ),
      ],
    };
    const fxAcquisition = makeFxAcquisitionResult();
    mockFxCostBasisLotService.reverse.mockResolvedValue(fxReversal);
    mockFxCostBasisLotService.acquire.mockReturnValue(fxAcquisition);

    const replacement = await usecase(original.id, payload);

    expect(mockFxCostBasisLotService.reverse).toHaveBeenCalledWith(
      original.id,
      repoOptions
    );
    expect(mockFxCostBasisLotService.acquire).toHaveBeenCalledWith({
      journalEntry: expect.objectContaining({ id: replacement.id }),
      account: destinationAccount,
      createdBy: actorId,
      officialRate: null,
    });
    const fxPersistence = mockFxCostBasisAppService.persistence;
    expect(fxPersistence.persistReversal).toHaveBeenCalledWith(
      fxReversal,
      actorId,
      transactionOptions
    );
    expect(fxPersistence.persistAcquisition).toHaveBeenCalledWith(
      fxAcquisition,
      actorId,
      transactionOptions
    );
    const [commitOrder] = mockRepoTransaction.commit.mock.invocationCallOrder;
    expect(
      fxPersistence.persistReversal.mock.invocationCallOrder[0]
    ).toBeLessThan(commitOrder);
    expect(
      fxPersistence.persistAcquisition.mock.invocationCallOrder[0]
    ).toBeLessThan(commitOrder);
  });

  it('rolls back without publishing or enqueueing when the FX acquisition write fails', async () => {
    const original = await makeOriginalReceipt(effectiveDate);
    mockJournalEntryRepo.findById.mockResolvedValue(original);
    mockFxCostBasisLotService.acquire.mockReturnValue(
      makeFxAcquisitionResult()
    );
    const failure = new Error('FX acquisition write failed');
    mockFxCostBasisAppService.persistence.persistAcquisition.mockRejectedValueOnce(
      failure
    );

    await expect(usecase(original.id, payload)).rejects.toBe(failure);

    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
    expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    expect(mockLedgerBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
  });

  it('rolls back when a replacement account is missing', async () => {
    const original = await makeOriginalReceipt(effectiveDate);
    mockJournalEntryRepo.findById.mockResolvedValue(original);
    mockLedgerAccountRepo.findAllByIds.mockResolvedValueOnce([sourceAccount]);

    await expect(usecase(original.id, payload)).rejects.toThrow(
      ledgerAppError.AccountNotFound
    );

    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(
      expect.any(ledgerAppError.AccountNotFound)
    );
    expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
    expect(
      mockJournalEntryPersistenceAppService.rectify
    ).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('returns the original when the correction service reports no changes', async () => {
    const original = await makeOriginalReceipt(effectiveDate);
    mockJournalEntryRepo.findById.mockResolvedValue(original);
    mockReceiptEntryService.voidAndReplace.mockResolvedValueOnce({
      voided: [original, [], null],
      reversal: null,
      replacement: null,
    });
    const correct = makeVoidAndReplaceReceiptUsecase({
      ...deps,
      receiptEntryService: mockReceiptEntryService,
    });

    await expect(correct(original.id, payload)).resolves.toMatchObject({
      id: original.id,
      status: original.status,
      memo: original.memo,
      effectiveDate: original.effectiveDate,
    });

    expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
    expect(
      mockJournalEntryPersistenceAppService.rectify
    ).not.toHaveBeenCalled();
    expect(mockFxCostBasisLotService.reverse).not.toHaveBeenCalled();
    expect(mockLedgerBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('maps the exchange rate on a foreign-currency draft replacement', async () => {
    const original = await makeOriginalReceipt(effectiveDate);
    mockJournalEntryRepo.findById.mockResolvedValue(original);
    const foreignAccount = {
      ...destinationAccount,
      currency: SYSTEM_CURRENCIES.USD,
    };
    mockLedgerAccountRepo.findAllByIds.mockResolvedValueOnce([
      sourceAccount,
      foreignAccount,
    ]);
    const exchangeRate = {
      baseCurrencyCode: 'USD',
      targetCurrencyCode: 'NGN',
      rate: 2,
      type: EExchangeRateType.Negotiated,
      asOf: replacementEffectiveDate,
      source: 'Bank quote',
    };

    await usecase(original.id, {
      ...payload,
      postedAt: null,
      destinationLine: {
        ...payload.destinationLine,
        amount: { amount: 4000, currencyCode: 'USD', isMinorUnit: true },
        exchangeRate,
      },
    });

    const [[persistence]] =
      mockJournalEntryPersistenceAppService.rectify.mock.calls;
    const [, replacement] = persistence.entriesToCreate;
    expect(replacement.entry.lines).toContainEqual(
      expect.objectContaining({
        accountId: foreignAccount.id,
        amount: moneyValue.make(4000n, SYSTEM_CURRENCIES.USD, true),
        functionalAmount: moneyValue.make(8000n, SYSTEM_CURRENCIES.NGN, true),
        exchangeRate: expect.objectContaining(exchangeRate),
      })
    );
  });

  it('rejects a draft original before journal persistence', async () => {
    const original = await makeOriginalReceipt(null);
    mockJournalEntryRepo.findById.mockResolvedValue(original);

    await expect(usecase(original.id, payload)).rejects.toThrow(
      journalEntryError.InvalidStatusTransition
    );

    expect(
      mockJournalEntryPersistenceAppService.rectify
    ).not.toHaveBeenCalled();
    expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
  });
});
