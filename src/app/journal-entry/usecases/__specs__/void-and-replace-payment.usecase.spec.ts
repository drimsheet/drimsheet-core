import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import { ERepoLock } from '@shared/types/repo.types';
import generateUUID from '@shared/utils/uuid-generator';
import { IFileAttachment } from '@shared/values/file-attachments/types/file-attachment.types';

import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import makePaymentEntryService from '@domain/journal-entry/services/payment-entry.service';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';
import fxCostBasisLotEntity from '@domain/subledger/fx-cost-basis/entities/lot.entity';

import { mockAccountingPeriodService } from '@app/accounting/contracts/__mocks__/accounting.domain.services.mock';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/types/app-context.types';
import { mockCounterpartyRepo } from '@app/counterparty/contracts/__mocks__/counterparty.repos.mock';
import mockFileManagementAppService from '@app/file/contracts/__mocks__/file-management.service.mock';
import { EFileUploadPurpose } from '@app/file/types/file.types';
import mockJournalEntryPersistenceAppService from '@app/journal-entry/contracts/__mocks__/journal-entry-persistence.service.mock';
import { mockJournalEntryRepo } from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';
import { IPaymentEntryReq } from '@app/journal-entry/dtos/payment-entry/payment-entry.dto';
import makeVoidAndReplacePaymentUsecase from '@app/journal-entry/usecases/void-and-replace-payment.usecase';
import mockLedgerBalanceAdjustmentQueue from '@app/ledger/contracts/__mocks__/ledger-balance-adjustment-queue.mock';
import {
  mockLedgerAccountBalanceRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import mockExchangeRateAppService from '@app/money/contracts/__mocks__/exchange-rate.service.mock';
import mockOutboxAppService from '@app/outbox/contracts/__mocks__/outbox.service.mock';
import { mockFxCostBasisLotService } from '@app/subledger/contracts/__mocks__/subledger.domain.services.mock';
import { makeFxDispositionResult } from '@app/subledger/fx-cost-basis/__fixtures__/fx-lot-results.fixture';
import mockFxCostBasisAppService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-cost-basis-persistence.service.mock';

const actorId = generateUUID();
const userId = generateUUID();
const accountingEntityId = generateUUID();
const effectiveDate = new Date('2026-09-01T00:00:00.000Z');
const replacementEffectiveDate = new Date('2026-09-03T00:00:00.000Z');
const [sourceAccount] = ledgerAccountEntity.make({
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
const [destinationAccount] = ledgerAccountEntity.make({
  ...sourceAccount,
  code: '300001',
  materializedPath: '300000.300001',
  name: 'Rent',
  type: 'expense',
  subType: 'rent_and_utilities',
  behavior: 'rent_and_utilities',
  openingBalanceDate: null,
});
const [counterparty] = counterpartyEntity.make({
  accountingEntityId,
  createdBy: actorId,
  name: 'Vendor',
  type: 'organization',
});
const repoOptions = {
  correlationId: 'payment-replacement',
  idempotencyKey: '',
};
const transactionOptions = { ...repoOptions, tx: mockRepoTransaction.context };
const paymentEntryService = makePaymentEntryService({
  accountingPeriodService: mockAccountingPeriodService,
  counterpartyRepo: mockCounterpartyRepo,
  ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
  ledgerAccountRepo: mockLedgerAccountRepo,
});
const usecase = makeVoidAndReplacePaymentUsecase({
  appContext: mockAppContext,
  counterpartyRepo: mockCounterpartyRepo,
  fileManagementAppService: mockFileManagementAppService,
  ledgerAccountRepo: mockLedgerAccountRepo,
  journalEntryRepo: mockJournalEntryRepo,
  paymentEntryService,
  journalEntryPersistenceAppService: mockJournalEntryPersistenceAppService,
  fxCostBasisLotService: mockFxCostBasisLotService,
  exchangeRateAppService: mockExchangeRateAppService,
  fxCostBasisPersistenceAppService: mockFxCostBasisAppService.persistence,
  outboxAppService: mockOutboxAppService,
  ledgerBalanceAdjustmentQueue: mockLedgerBalanceAdjustmentQueue,
  repoService: mockRepoService,
  eventBus: mockEventBus,
});
const sourceLine = {
  accountId: sourceAccount.id,
  counterpartyId: counterparty.id,
  amount: { amount: 8000, currencyCode: 'NGN', isMinorUnit: true },
  exchangeRate: null,
  description: null,
  sequenceOrder: 1,
};
const payload: IPaymentEntryReq = {
  effectiveDate: replacementEffectiveDate,
  postedAt: replacementEffectiveDate,
  memo: 'Corrected rent payment',
  sourceLine,
  destinationLines: [
    { ...sourceLine, accountId: destinationAccount.id, sequenceOrder: 2 },
  ],
};

async function makeOriginalPayment(
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
  const [entry] = await paymentEntryService.create(
    {
      header: {
        accountingEntityId,
        effectiveDate,
        postedAt,
        memo: 'Rent payment',
        functionalCurrencyCode: 'NGN',
        createdBy: actorId,
      },
      sourceLine: line,
      destinationLines: [
        { ...line, account: destinationAccount, sequenceOrder: 2 },
      ],
      attachments,
    },
    repoOptions
  );
  return entry;
}

describe('makeVoidAndReplacePaymentUsecase', () => {
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
    mockFxCostBasisLotService.dispose.mockResolvedValue(null);
  });

  it('persists the void, exact reversal, and replacement together before publishing', async () => {
    const original = await makeOriginalPayment(effectiveDate);
    mockJournalEntryRepo.findById.mockResolvedValue(original);
    mockAccountingPeriodService.validatePostingPeriod.mockClear();

    const attachmentReference = generateUUID();
    const attachment = {
      url: 'https://files.example.com/corrected-payment.pdf',
      name: 'corrected-payment.pdf',
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
    expect(mockOutboxAppService.createBalancePropagation.mock.calls).toEqual([
      [reversal.entry.id, transactionOptions],
      [replacement.entry.id, transactionOptions],
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
    const original = await makeOriginalPayment(effectiveDate);
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
    expect(mockFxCostBasisLotService.dispose).not.toHaveBeenCalled();
    expect(mockOutboxAppService.createBalancePropagation.mock.calls).toEqual([
      [reversal.entry.id, transactionOptions],
    ]);
    expect(mockLedgerBalanceAdjustmentQueue.add.mock.calls).toEqual([
      [repoOptions.correlationId, { journalEntryId: reversal.entry.id }],
    ]);
    expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])(
    'uses the requested attachment set when replacing a payment, clear=%s',
    async (clear) => {
      const attachment = {
        url: 'https://files.example.com/original-payment.pdf',
        name: 'original-payment.pdf',
        type: 'application/pdf',
        size: 1024,
      };
      const original = await makeOriginalPayment(effectiveDate, [attachment]);
      mockJournalEntryRepo.findById.mockResolvedValue(original);

      const response = await usecase(original.id, {
        ...payload,
        attachmentReferences: clear ? [] : undefined,
      });

      expect(response.attachments).toEqual(clear ? [] : [attachment]);
      expect(mockFileManagementAppService.claimUploads).toHaveBeenCalledTimes(
        clear ? 1 : 0
      );
      const [[persistence]] =
        mockJournalEntryPersistenceAppService.rectify.mock.calls;
      expect(persistence.entryUpdate?.entry.attachments).toEqual([attachment]);
      expect(persistence.entriesToCreate[1].entry.attachments).toEqual(
        response.attachments
      );
    }
  );

  it.each([false, true])(
    'allocates from restored FX lots in the same transaction, failure=%s',
    async (fails) => {
      const original = await makeOriginalPayment(effectiveDate);
      mockJournalEntryRepo.findById.mockResolvedValue(original);
      const disposition = makeFxDispositionResult();
      const [[consumedLot]] = disposition.lots;
      const [restoredLot, restoredEvents, restorationAudit] =
        fxCostBasisLotEntity.reverseDisposition(
          consumedLot,
          consumedLot.originalQuantity,
          consumedLot.costBasis
        );
      const restoration = {
        lots: [[restoredLot, restoredEvents, restorationAudit!]],
      } satisfies NonNullable<
        Awaited<ReturnType<typeof mockFxCostBasisLotService.reverse>>
      >;
      mockFxCostBasisLotService.reverse.mockResolvedValue(restoration);
      const fxPersistence = mockFxCostBasisAppService.persistence;
      const failure = new Error('FX allocation failed');
      mockFxCostBasisLotService.dispose.mockImplementationOnce(
        async (_payload, options) => {
          expect(options).toEqual(transactionOptions);
          expect(fxPersistence.persistReversal).toHaveBeenCalledWith(
            restoration,
            actorId,
            options
          );
          if (fails) {
            throw failure;
          }
          return disposition;
        }
      );

      if (fails) {
        await expect(usecase(original.id, payload)).rejects.toBe(failure);
        expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
        expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
        expect(
          mockOutboxAppService.createBalancePropagation
        ).not.toHaveBeenCalled();
        expect(mockEventBus.publish).not.toHaveBeenCalled();
        expect(mockLedgerBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
      } else {
        await usecase(original.id, payload);
        expect(fxPersistence.persistDisposition).toHaveBeenCalledWith(
          disposition,
          actorId,
          transactionOptions
        );
        expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
      }
    }
  );

  it('rejects a draft before journal persistence', async () => {
    const original = await makeOriginalPayment(null);
    mockJournalEntryRepo.findById.mockResolvedValue(original);

    await expect(usecase(original.id, payload)).rejects.toThrow(
      journalEntryError.InvalidStatusTransition
    );

    expect(
      mockJournalEntryPersistenceAppService.rectify
    ).not.toHaveBeenCalled();
    expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
  });

  it('rejects a second correction of the same payment', async () => {
    const original = await makeOriginalPayment(effectiveDate);
    const [voided] = journalEntryEntity.void(original, {
      voidingEntryId: generateUUID(),
    });
    mockJournalEntryRepo.findById.mockResolvedValue(voided);

    await expect(usecase(original.id, payload)).rejects.toThrow(
      journalEntryError.InvalidStatusTransition
    );

    expect(
      mockJournalEntryPersistenceAppService.rectify
    ).not.toHaveBeenCalled();
    expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
  });
});
