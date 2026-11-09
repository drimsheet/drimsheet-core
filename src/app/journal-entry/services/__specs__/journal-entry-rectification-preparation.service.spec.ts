import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';

import periodError from '@domain/accounting/errors/period.error';
import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import makeJournalEntryRectificationService from '@domain/journal-entry/services/journal-entry-rectification.service';
import makePaymentEntryService from '@domain/journal-entry/services/payment-entry.service';
import { IJournalEntryRectificationResult } from '@domain/journal-entry/types/journal-entry-rectification.types';
import {
  EJournalEntryRectificationMode,
  EJournalEntrySourceType,
  IJournalEntry,
  UJournalEntryRectificationMode,
  UJournalEntrySourceType,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerAccountStatus,
  ELedgerType,
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';

import { mockAccountingPeriodService } from '@app/accounting/contracts/__mocks__/accounting.domain.services.mock';
import { mockCounterpartyRepo } from '@app/counterparty/contracts/__mocks__/counterparty.repos.mock';
import {
  mockJournalEntryRectificationService,
  mockPaymentEntryService,
  mockReceiptEntryService,
  mockTransferEntryService,
} from '@app/journal-entry/contracts/__mocks__/journal-entry.domain.services.mock';
import {
  IPaymentJournalEntryRectificationReq,
  IReceiptJournalEntryRectificationReq,
  ITransferJournalEntryRectificationReq,
  TJournalEntryRectificationReq,
} from '@app/journal-entry/dtos/journal-entry-rectification/journal-entry-rectification.dto';
import makeJournalEntryRectificationPreparationAppService from '@app/journal-entry/services/journal-entry-rectification-preparation.service';
import {
  mockLedgerAccountBalanceRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import mockExchangeRateAppService from '@app/money/contracts/__mocks__/exchange-rate.service.mock';
import { mockFxCostBasisLotService } from '@app/subledger/contracts/__mocks__/subledger.domain.services.mock';

describe('makeJournalEntryRectificationPreparationAppService', () => {
  const accountingEntityId = generateUUID();
  const userId = generateUUID();
  const sourceAccount = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: generateUUID(),
  } as ILedgerAccount;
  const destinationAccount = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: generateUUID(),
  } as ILedgerAccount;
  const chargeAccount = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: generateUUID(),
  } as ILedgerAccount;
  const accountingEntity = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: accountingEntityId,
    functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
  } as IAccountingEntity;
  const effectiveDate = new Date('2026-09-01T00:00:00.000Z');
  const repoOptions = { correlationId: 'preparation-correlation-id' };
  const amountDto = {
    amount: 100,
    currencyCode: SYSTEM_CURRENCIES.NGN.code,
    isMinorUnit: false,
  };
  const [counterparty] = counterpartyEntity.make({
    accountingEntityId,
    createdBy: userId,
    name: 'Counterparty',
    type: 'organization',
  });
  const counterpartyId = counterparty.id;
  const actor = userId;
  const service = makeJournalEntryRectificationPreparationAppService({
    counterpartyRepo: mockCounterpartyRepo,
    paymentEntryService: mockPaymentEntryService,
    receiptEntryService: mockReceiptEntryService,
    transferEntryService: mockTransferEntryService,
    journalEntryRectificationService: mockJournalEntryRectificationService,
    ledgerAccountRepo: mockLedgerAccountRepo,
    fxCostBasisLotService: mockFxCostBasisLotService,
    exchangeRateAppService: mockExchangeRateAppService,
  });

  function makeEntry(
    sourceType: UJournalEntrySourceType,
    amountValue = 100,
    postedAt: Date | null = effectiveDate
  ) {
    const amount = moneyValue.make(amountValue, SYSTEM_CURRENCIES.NGN, false);

    return journalEntryEntity.make({
      accountingEntityId,
      sourceType,
      effectiveDate,
      postedAt,
      memo: 'Journal entry',
      createdBy: userId,
      functionalCurrency: SYSTEM_CURRENCIES.NGN,
      lines: [
        {
          accountId: sourceAccount.id,
          counterpartyId: null,
          sequenceOrder: 1,
          amount,
          exchangeRate: null,
          side: EJournalSide.Credit,
          description: 'Source',
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
        {
          accountId: destinationAccount.id,
          counterpartyId: null,
          sequenceOrder: 2,
          amount,
          exchangeRate: null,
          side: EJournalSide.Debit,
          description: 'Destination',
          functionalCurrency: SYSTEM_CURRENCIES.NGN,
        },
      ],
    });
  }

  function makeRectificationResult(
    originalEntry: IJournalEntry,
    currentJournalEntry: IJournalEntry,
    mode: UJournalEntryRectificationMode = EJournalEntryRectificationMode.UpdateMeta
  ): IJournalEntryRectificationResult {
    return {
      mode,
      originalJournalEntryId: originalEntry.id,
      currentJournalEntry,
      reversingJournalEntry: null,
      entriesToCreate: [],
      entryUpdate: null,
      events: [],
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockExchangeRateAppService.getOfficialRate.mockResolvedValue(null);
    mockCounterpartyRepo.findByIds.mockResolvedValue([counterparty]);
    mockJournalEntryRectificationService.rectify.mockImplementation(
      async ({ originalEntry, newEntry }) =>
        makeRectificationResult(originalEntry, newEntry as IJournalEntry)
    );
    mockFxCostBasisLotService.reverse.mockResolvedValue(null);
    mockFxCostBasisLotService.dispose.mockResolvedValue(null);
    mockFxCostBasisLotService.acquire.mockReturnValue(null);
    mockLedgerAccountRepo.findById.mockImplementation(async (id) => {
      if (id === sourceAccount.id) {
        return sourceAccount;
      }
      if (id === destinationAccount.id) {
        return destinationAccount;
      }
      if (id === chargeAccount.id) {
        return chargeAccount;
      }
      return null;
    });
  });

  it.each([
    [null, null],
    [null, effectiveDate],
    [effectiveDate, null],
    [effectiveDate, effectiveDate],
  ] as const)(
    'prepares payment counterparties for effective posting state %s / %s',
    async (originalPostedAt, requestedPostedAt) => {
      const [originalEntry] = makeEntry(
        EJournalEntrySourceType.Payment,
        100,
        originalPostedAt
      );
      const candidate = makeEntry(
        EJournalEntrySourceType.Payment,
        100,
        originalPostedAt ?? requestedPostedAt
      );
      const requestedEntry: IPaymentJournalEntryRectificationReq = {
        sourceType: EJournalEntrySourceType.Payment,
        attachments: [],
        effectiveDate,
        postedAt: requestedPostedAt,
        memo: 'Payment',
        sourceLine: {
          id: originalEntry.lines[0].id,
          accountId: sourceAccount.id,
          counterpartyId,
          amount: amountDto,
          exchangeRate: null,
          description: 'Source',
          sequenceOrder: 1,
        },
        destinationLines: [
          {
            id: originalEntry.lines[1].id,
            accountId: destinationAccount.id,
            counterpartyId,
            amount: amountDto,
            exchangeRate: null,
            description: 'Destination',
            sequenceOrder: 2,
          },
        ],
      };
      mockPaymentEntryService.create.mockResolvedValue(candidate);

      const result = await service.prepare(
        {
          originalEntry,
          requestedEntry,
          accountingEntity,

          actor,
        },
        repoOptions
      );

      expect(mockCounterpartyRepo.findByIds).toHaveBeenCalledWith(
        expect.any(Array),
        accountingEntityId,
        repoOptions
      );
      expect(mockPaymentEntryService.create).toHaveBeenCalledTimes(1);
      expect(mockPaymentEntryService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          header: expect.objectContaining({
            postedAt: originalPostedAt ?? requestedPostedAt,
          }),
        }),
        repoOptions
      );
      expect(
        result.rectification.currentJournalEntry.lines.map((line) => line.id)
      ).toEqual(originalEntry.lines.map((line) => line.id));
      expect(result).toMatchObject({
        fxReversal: null,
        fxDisposition: null,
        fxAcquisition: null,
      });
    }
  );

  it.each(
    (['receipt', 'transfer'] as const).flatMap((sourceType) =>
      (
        [
          [null, null],
          [null, effectiveDate],
          [effectiveDate, null],
          [effectiveDate, effectiveDate],
        ] as const
      ).map(([originalPostedAt, requestedPostedAt]) => ({
        sourceType,
        originalPostedAt,
        requestedPostedAt,
      }))
    )
  )(
    'forwards effective posting intent for $sourceType: $originalPostedAt / $requestedPostedAt',
    async ({ sourceType, originalPostedAt, requestedPostedAt }) => {
      const [originalEntry] = makeEntry(sourceType, 100, originalPostedAt);
      const postedAt = originalPostedAt ?? requestedPostedAt;
      const candidate = makeEntry(sourceType, 100, postedAt);
      const base = {
        attachments: [],
        effectiveDate,
        postedAt: requestedPostedAt,
        memo: 'Draft edit',
      };
      const sourceLine = {
        accountId: sourceAccount.id,
        counterpartyId,
        amount: amountDto,
        exchangeRate: null,
        description: null,
        sequenceOrder: 1,
      };
      const destinationLine = {
        ...sourceLine,
        accountId: destinationAccount.id,
        sequenceOrder: 2,
      };
      const requestedEntry:
        | IReceiptJournalEntryRectificationReq
        | ITransferJournalEntryRectificationReq =
        sourceType === 'receipt'
          ? { ...base, sourceType, sourceLines: [sourceLine], destinationLine }
          : {
              ...base,
              sourceType,
              sourceLine,
              destinationLine,
              chargeLines: [
                {
                  ...sourceLine,
                  accountId: chargeAccount.id,
                  sequenceOrder: 3,
                },
              ],
            };
      mockReceiptEntryService.create.mockResolvedValue(candidate);
      mockTransferEntryService.create.mockResolvedValue({
        journalEntry: candidate,
        destinationAssetAccount: destinationAccount,
      });
      await service.prepare(
        { originalEntry, requestedEntry, accountingEntity, actor },
        repoOptions
      );
      expect(mockCounterpartyRepo.findByIds).toHaveBeenCalledWith(
        expect.any(Array),
        accountingEntityId,
        repoOptions
      );
      const creation =
        sourceType === 'receipt'
          ? mockReceiptEntryService.create
          : mockTransferEntryService.create;
      expect(creation).toHaveBeenCalledWith(
        expect.objectContaining({
          header: expect.objectContaining({ postedAt }),
        }),
        repoOptions
      );
      expect(mockFxCostBasisLotService.acquire).not.toHaveBeenCalled();
      expect(mockFxCostBasisLotService.dispose).not.toHaveBeenCalled();
    }
  );

  describe('posting guards through the real journal domain service', () => {
    it.each(
      (['account', 'counterparty'] as const).flatMap((reference) =>
        (
          [
            [null, effectiveDate],
            [effectiveDate, effectiveDate],
            [effectiveDate, null],
          ] as const
        ).map(([originalPostedAt, requestedPostedAt]) => ({
          reference,
          originalPostedAt,
          requestedPostedAt,
        }))
      )
    )(
      'rejects draft $reference with original $originalPostedAt and requested $requestedPostedAt',
      async ({ reference, originalPostedAt, requestedPostedAt }) => {
        const [source] = ledgerAccountEntity.make({
          accountingEntityId,
          createdBy: actor,
          code: '100001',
          materializedPath: '100001',
          type: ELedgerType.Asset,
          subType: 'cash_and_cash_equivalent',
          behavior: 'petty_cash',
          normalBalance: EJournalSide.Debit,
          name: 'Petty cash',
          isControlAccount: false,
          controlAccountId: null,
          currency: SYSTEM_CURRENCIES.NGN,
          status: ELedgerAccountStatus.Active,
          contraAccountRule: EContraAccountRule.ContraPermitted,
          adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
          meta: {},
        });
        const [destination] = ledgerAccountEntity.make({
          ...source,
          code: '502001',
          materializedPath: '502000.502001',
          type: ELedgerType.Expense,
          subType: 'rent_and_utilities',
          behavior: 'rent_and_utilities',
          name: 'Rent expense',
          controlAccountId: generateUUID(),
          status:
            reference === 'account'
              ? ELedgerAccountStatus.Draft
              : ELedgerAccountStatus.Active,
        });
        mockLedgerAccountRepo.findById.mockImplementation(async (id) =>
          id === source.id ? source : id === destination.id ? destination : null
        );
        if (reference === 'counterparty') {
          mockCounterpartyRepo.findByIds.mockResolvedValue([
            Object.freeze({ ...counterparty, status: 'draft' as const }),
          ]);
        }
        const paymentEntryService = makePaymentEntryService({
          accountingPeriodService: mockAccountingPeriodService,
          counterpartyRepo: mockCounterpartyRepo,
          ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
          ledgerAccountRepo: mockLedgerAccountRepo,
        });
        const guardedPreparation =
          makeJournalEntryRectificationPreparationAppService({
            counterpartyRepo: mockCounterpartyRepo,
            paymentEntryService,
            receiptEntryService: mockReceiptEntryService,
            transferEntryService: mockTransferEntryService,
            journalEntryRectificationService:
              mockJournalEntryRectificationService,
            ledgerAccountRepo: mockLedgerAccountRepo,
            fxCostBasisLotService: mockFxCostBasisLotService,
            exchangeRateAppService: mockExchangeRateAppService,
          });
        const [originalEntry] = makeEntry('payment', 100, originalPostedAt);
        const requestedEntry: IPaymentJournalEntryRectificationReq = {
          sourceType: 'payment',
          attachments: [],
          effectiveDate,
          postedAt: requestedPostedAt,
          memo: 'Correction',
          sourceLine: {
            accountId: source.id,
            counterpartyId,
            amount: amountDto,
            exchangeRate: null,
            description: null,
            sequenceOrder: 1,
          },
          destinationLines: [
            {
              accountId: destination.id,
              counterpartyId,
              amount: amountDto,
              exchangeRate: null,
              description: null,
              sequenceOrder: 2,
            },
          ],
        };

        await expect(
          guardedPreparation.prepare(
            {
              originalEntry,
              requestedEntry,
              accountingEntity,
              actor,
            },
            repoOptions
          )
        ).rejects.toBeInstanceOf(
          reference === 'account'
            ? journalEntryError.DraftLedgerAccountNotAllowed
            : journalEntryError.DraftCounterpartyNotAllowed
        );
        expect(
          mockJournalEntryRectificationService.rectify
        ).not.toHaveBeenCalled();
        expect(mockFxCostBasisLotService.reverse).not.toHaveBeenCalled();
        expect(mockFxCostBasisLotService.acquire).not.toHaveBeenCalled();
        expect(mockFxCostBasisLotService.dispose).not.toHaveBeenCalled();
      }
    );
  });

  it('prepares a receipt through the receipt domain capability', async () => {
    const [originalEntry] = makeEntry(EJournalEntrySourceType.Receipt);
    const candidate = makeEntry(EJournalEntrySourceType.Receipt);
    const requestedEntry: IReceiptJournalEntryRectificationReq = {
      sourceType: EJournalEntrySourceType.Receipt,
      attachments: [],
      effectiveDate,
      postedAt: effectiveDate,
      memo: 'Receipt',
      sourceLines: [
        {
          accountId: sourceAccount.id,
          counterpartyId,
          amount: amountDto,
          exchangeRate: {
            baseCurrencyCode: 'USD',
            targetCurrencyCode: 'NGN',
            rate: 1.5,
            type: 'negotiated',
            asOf: effectiveDate,
            source: 'test-source',
          },
          description: 'Source',
          sequenceOrder: 1,
        },
      ],
      destinationLine: {
        accountId: destinationAccount.id,
        counterpartyId,
        amount: amountDto,
        exchangeRate: null,
        description: 'Destination',
        sequenceOrder: 2,
      },
    };
    mockReceiptEntryService.create.mockResolvedValue(candidate);
    mockJournalEntryRectificationService.rectify.mockImplementation(
      async ({ originalEntry: entryToReplace, newEntry }) =>
        makeRectificationResult(
          entryToReplace,
          newEntry as IJournalEntry,
          EJournalEntryRectificationMode.VoidAndReplace
        )
    );

    const result = await service.prepare(
      {
        originalEntry,
        requestedEntry,
        accountingEntity,

        actor,
      },
      repoOptions
    );

    expect(mockReceiptEntryService.create).toHaveBeenCalledTimes(1);
    expect(
      result.rectification.currentJournalEntry.lines.map((line) => line.id)
    ).toEqual(candidate[0].lines.map((line) => line.id));
    expect(mockFxCostBasisLotService.acquire).toHaveBeenCalledWith(
      expect.objectContaining({
        account: destinationAccount,
        createdBy: actor,
        officialRate: null,
      })
    );
    expect(mockFxCostBasisLotService.dispose).not.toHaveBeenCalled();
  });

  it('prepares a transfer through the transfer domain capability', async () => {
    const [originalEntry] = makeEntry(EJournalEntrySourceType.Transfer);
    const candidate = makeEntry(EJournalEntrySourceType.Transfer);
    const requestedEntry: ITransferJournalEntryRectificationReq = {
      sourceType: EJournalEntrySourceType.Transfer,
      attachments: [],
      effectiveDate,
      postedAt: effectiveDate,
      memo: 'Transfer',
      sourceLine: {
        accountId: sourceAccount.id,
        amount: amountDto,
        exchangeRate: null,
        description: 'Source',
        sequenceOrder: 1,
      },
      destinationLine: {
        accountId: destinationAccount.id,
        amount: amountDto,
        exchangeRate: null,
        description: 'Destination',
        sequenceOrder: 2,
      },
      chargeLines: [
        {
          accountId: chargeAccount.id,
          counterpartyId,
          amount: amountDto,
          exchangeRate: null,
          description: 'Charge with counterparty',
          sequenceOrder: 3,
        },
        {
          accountId: chargeAccount.id,
          counterpartyId: null,
          amount: amountDto,
          exchangeRate: null,
          description: 'Charge without counterparty',
          sequenceOrder: 4,
        },
      ],
    };
    mockTransferEntryService.create.mockResolvedValue({
      journalEntry: candidate,
      destinationAssetAccount: destinationAccount,
    });
    mockJournalEntryRectificationService.rectify.mockImplementation(
      async ({ originalEntry: entryToReplace, newEntry }) =>
        makeRectificationResult(
          entryToReplace,
          newEntry as IJournalEntry,
          EJournalEntryRectificationMode.VoidAndReplace
        )
    );

    const result = await service.prepare(
      {
        originalEntry,
        requestedEntry,
        accountingEntity,

        actor,
      },
      repoOptions
    );

    expect(mockTransferEntryService.create).toHaveBeenCalledTimes(1);
    expect(
      result.rectification.currentJournalEntry.lines.map((line) => line.id)
    ).toEqual(candidate[0].lines.map((line) => line.id));
    expect(mockFxCostBasisLotService.dispose).toHaveBeenCalledTimes(1);
    expect(mockFxCostBasisLotService.acquire).toHaveBeenCalledTimes(1);
    expect(
      mockFxCostBasisLotService.dispose.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mockFxCostBasisLotService.acquire.mock.invocationCallOrder[0]
    );
  });

  it('rejects unsupported source types before domain preparation', async () => {
    const [originalEntry] = makeEntry(EJournalEntrySourceType.Payment);
    const requestedEntry = {
      sourceType: EJournalEntrySourceType.Reversal,
    } as never;

    await expect(
      service.prepare(
        {
          originalEntry,
          requestedEntry,
          accountingEntity,

          actor,
        },
        repoOptions
      )
    ).rejects.toBeInstanceOf(appError.BadRequest);

    expect(mockPaymentEntryService.create).not.toHaveBeenCalled();
    expect(mockReceiptEntryService.create).not.toHaveBeenCalled();
    expect(mockTransferEntryService.create).not.toHaveBeenCalled();
  });

  it('prepares the FX-lot reversal before corrected source effects', async () => {
    const [originalEntry] = makeEntry(EJournalEntrySourceType.Payment);
    const [correctedEntry] = makeEntry(EJournalEntrySourceType.Payment, 200);
    const requestedEntry: IPaymentJournalEntryRectificationReq = {
      sourceType: EJournalEntrySourceType.Payment,
      attachments: [],
      effectiveDate,
      postedAt: effectiveDate,
      memo: 'Payment',
      sourceLine: {
        accountId: sourceAccount.id,
        counterpartyId,
        amount: amountDto,
        exchangeRate: null,
        description: 'Source',
        sequenceOrder: 1,
      },
      destinationLines: [
        {
          accountId: destinationAccount.id,
          counterpartyId,
          amount: amountDto,
          exchangeRate: null,
          description: 'Destination',
          sequenceOrder: 2,
        },
      ],
    };
    const rectification = makeRectificationResult(
      originalEntry,
      correctedEntry,
      EJournalEntryRectificationMode.VoidAndReplace
    );
    mockPaymentEntryService.create.mockResolvedValue([
      correctedEntry,
      [],
      { header: {} as never, lines: [] },
    ]);
    mockJournalEntryRectificationService.rectify.mockResolvedValue(
      rectification
    );

    await expect(
      service.prepare(
        {
          originalEntry,
          requestedEntry,
          accountingEntity,

          actor,
        },
        repoOptions
      )
    ).resolves.toMatchObject({ rectification, fxReversal: null });

    expect(mockFxCostBasisLotService.reverse).toHaveBeenCalledWith(
      originalEntry.id,
      repoOptions
    );
    expect(mockFxCostBasisLotService.dispose).toHaveBeenCalledWith(
      {
        journalEntry: correctedEntry,
        account: sourceAccount,
        createdBy: actor,
        officialRate: null,
      },
      repoOptions
    );
    expect(
      mockFxCostBasisLotService.reverse.mock.invocationCallOrder[0]
    ).toBeLessThan(
      mockFxCostBasisLotService.dispose.mock.invocationCallOrder[0]
    );
  });

  it('stops rectification preparation when the FX-lot reversal fails', async () => {
    const [originalEntry] = makeEntry(EJournalEntrySourceType.Payment);
    const [correctedEntry] = makeEntry(EJournalEntrySourceType.Payment, 200);
    const requestedEntry: IPaymentJournalEntryRectificationReq = {
      sourceType: EJournalEntrySourceType.Payment,
      attachments: [],
      effectiveDate,
      postedAt: effectiveDate,
      memo: 'Payment',
      sourceLine: {
        accountId: sourceAccount.id,
        counterpartyId,
        amount: amountDto,
        exchangeRate: null,
        description: 'Source',
        sequenceOrder: 1,
      },
      destinationLines: [
        {
          accountId: destinationAccount.id,
          counterpartyId,
          amount: amountDto,
          exchangeRate: null,
          description: 'Destination',
          sequenceOrder: 2,
        },
      ],
    };
    mockPaymentEntryService.create.mockResolvedValue([
      correctedEntry,
      [],
      { header: {} as never, lines: [] },
    ]);
    mockJournalEntryRectificationService.rectify.mockResolvedValue(
      makeRectificationResult(
        originalEntry,
        correctedEntry,
        EJournalEntryRectificationMode.VoidAndReplace
      )
    );
    const failure = new Error('FX reversal failed');
    mockFxCostBasisLotService.reverse.mockRejectedValue(failure);

    await expect(
      service.prepare(
        {
          originalEntry,
          requestedEntry,
          accountingEntity,

          actor,
        },
        repoOptions
      )
    ).rejects.toBe(failure);

    expect(mockFxCostBasisLotService.dispose).not.toHaveBeenCalled();
    expect(mockFxCostBasisLotService.acquire).not.toHaveBeenCalled();
  });

  it('prepares current FX effects when rectification posts a draft', async () => {
    const [originalEntry] = makeEntry(
      EJournalEntrySourceType.Payment,
      100,
      null
    );
    const [postedEntry] = makeEntry(EJournalEntrySourceType.Payment);
    const requestedEntry: IPaymentJournalEntryRectificationReq = {
      sourceType: EJournalEntrySourceType.Payment,
      attachments: [],
      effectiveDate,
      postedAt: effectiveDate,
      memo: 'Payment',
      sourceLine: {
        accountId: sourceAccount.id,
        counterpartyId,
        amount: amountDto,
        exchangeRate: null,
        description: 'Source',
        sequenceOrder: 1,
      },
      destinationLines: [
        {
          accountId: destinationAccount.id,
          counterpartyId,
          amount: amountDto,
          exchangeRate: null,
          description: 'Destination',
          sequenceOrder: 2,
        },
      ],
    };
    const rectification = makeRectificationResult(
      originalEntry,
      postedEntry,
      EJournalEntryRectificationMode.UpdateDraft
    );
    mockPaymentEntryService.create.mockResolvedValue([
      postedEntry,
      [],
      { header: {} as never, lines: [] },
    ]);
    mockJournalEntryRectificationService.rectify.mockResolvedValue(
      rectification
    );

    await service.prepare(
      {
        originalEntry,
        requestedEntry,
        accountingEntity,

        actor,
      },
      repoOptions
    );

    expect(mockFxCostBasisLotService.reverse).not.toHaveBeenCalled();
    expect(mockFxCostBasisLotService.dispose).toHaveBeenCalledWith(
      {
        journalEntry: postedEntry,
        account: sourceAccount,
        createdBy: actor,
        officialRate: null,
      },
      repoOptions
    );
  });

  it('rejects corrected FX effects for an unsupported source type', async () => {
    const [originalEntry] = makeEntry(EJournalEntrySourceType.Payment);
    const [unsupportedEntry] = makeEntry(EJournalEntrySourceType.Reversal);
    const requestedEntry: IPaymentJournalEntryRectificationReq = {
      sourceType: EJournalEntrySourceType.Payment,
      attachments: [],
      effectiveDate,
      postedAt: effectiveDate,
      memo: 'Payment',
      sourceLine: {
        accountId: sourceAccount.id,
        counterpartyId,
        amount: amountDto,
        exchangeRate: null,
        description: 'Source',
        sequenceOrder: 1,
      },
      destinationLines: [
        {
          accountId: destinationAccount.id,
          counterpartyId,
          amount: amountDto,
          exchangeRate: null,
          description: 'Destination',
          sequenceOrder: 2,
        },
      ],
    };
    mockPaymentEntryService.create.mockResolvedValue([
      unsupportedEntry,
      [],
      { header: {} as never, lines: [] },
    ]);
    mockJournalEntryRectificationService.rectify.mockResolvedValue(
      makeRectificationResult(
        originalEntry,
        unsupportedEntry,
        EJournalEntryRectificationMode.VoidAndReplace
      )
    );

    await expect(
      service.prepare(
        {
          originalEntry,
          requestedEntry,
          accountingEntity,

          actor,
        },
        repoOptions
      )
    ).rejects.toBeInstanceOf(appError.BadRequest);

    expect(mockFxCostBasisLotService.dispose).not.toHaveBeenCalled();
    expect(mockFxCostBasisLotService.acquire).not.toHaveBeenCalled();
  });
  it.each([
    periodError.PostingPeriodNotOpen,
    periodError.PostingDateNotCovered,
  ])(
    'propagates reversal-period rejection before preparing FX effects (%p)',
    async (ErrorType) => {
      jest.useFakeTimers();
      const replacementDate = new Date('2026-10-01T10:00:00.000Z');
      jest.setSystemTime(replacementDate);
      try {
        const [originalEntry] = makeEntry(EJournalEntrySourceType.Transfer);
        const candidate = makeEntry(EJournalEntrySourceType.Transfer, 150);
        const sourceLine = {
          accountId: sourceAccount.id,
          amount: amountDto,
          exchangeRate: null,
          description: null,
          sequenceOrder: 1,
        };
        const requestedEntry: ITransferJournalEntryRectificationReq = {
          sourceType: EJournalEntrySourceType.Transfer,
          attachments: [],
          effectiveDate: replacementDate,
          postedAt: effectiveDate,
          memo: 'Correction',
          sourceLine,
          destinationLine: {
            ...sourceLine,
            accountId: destinationAccount.id,
            sequenceOrder: 2,
          },
          chargeLines: [],
        };
        mockTransferEntryService.create.mockResolvedValueOnce({
          journalEntry: [
            { ...candidate[0], effectiveDate: replacementDate },
            candidate[1],
            candidate[2],
          ],
          destinationAssetAccount: destinationAccount,
        });
        const failure = new ErrorType({
          accountingEntityId,
          postingDate: originalEntry.effectiveDate,
        });
        mockAccountingPeriodService.validatePostingPeriod.mockReset();
        mockAccountingPeriodService.validatePostingPeriod
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(failure);
        mockLedgerAccountRepo.findAllByIds.mockResolvedValueOnce([]);
        const realRectificationService = makeJournalEntryRectificationService({
          accountingPeriodService: mockAccountingPeriodService,
          ledgerAccountRepo: mockLedgerAccountRepo,
        });
        mockJournalEntryRectificationService.rectify.mockImplementationOnce(
          realRectificationService.rectify
        );

        await expect(
          service.prepare(
            { originalEntry, requestedEntry, accountingEntity, actor },
            repoOptions
          )
        ).rejects.toBe(failure);

        expect(
          mockAccountingPeriodService.validatePostingPeriod
        ).toHaveBeenNthCalledWith(
          1,
          accountingEntityId,
          replacementDate,
          repoOptions
        );
        expect(
          mockAccountingPeriodService.validatePostingPeriod
        ).toHaveBeenNthCalledWith(
          2,
          accountingEntityId,
          originalEntry.effectiveDate,
          repoOptions
        );
        expect(mockFxCostBasisLotService.reverse).not.toHaveBeenCalled();
        expect(mockFxCostBasisLotService.acquire).not.toHaveBeenCalled();
        expect(mockFxCostBasisLotService.dispose).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    }
  );
  it.each(['payment', 'receipt', 'transfer'] as const)(
    'rejects a partially resolved counterparty batch before preparing a %s rectification',
    async (sourceType) => {
      const missingId = generateUUID();
      const sourceLine = {
        accountId: sourceAccount.id,
        counterpartyId,
        amount: amountDto,
        exchangeRate: null,
        description: null,
        sequenceOrder: 1,
      };
      const destinationLine = {
        ...sourceLine,
        accountId: destinationAccount.id,
        counterpartyId: missingId,
        sequenceOrder: 2,
      };
      const base = {
        attachments: [],
        effectiveDate,
        postedAt: null,
        memo: null,
      };
      const requestedEntry: TJournalEntryRectificationReq =
        sourceType === 'payment'
          ? {
              ...base,
              sourceType,
              sourceLine,
              destinationLines: [destinationLine],
            }
          : sourceType === 'receipt'
            ? {
                ...base,
                sourceType,
                sourceLines: [sourceLine],
                destinationLine,
              }
            : {
                ...base,
                sourceType,
                sourceLine,
                destinationLine,
                chargeLines: [
                  { ...destinationLine, accountId: chargeAccount.id },
                ],
              };
      mockCounterpartyRepo.findByIds.mockResolvedValueOnce([counterparty]);
      const [originalEntry] = makeEntry(sourceType);

      await expect(
        service.prepare(
          {
            originalEntry,
            requestedEntry,
            accountingEntity,
            actor,
          },
          repoOptions
        )
      ).rejects.toMatchObject({
        errorKey: new counterpartyError.InvalidCounterpartyId().errorKey,
        cause: { id: missingId },
      });

      expect(mockPaymentEntryService.create).not.toHaveBeenCalled();
      expect(mockReceiptEntryService.create).not.toHaveBeenCalled();
      expect(mockTransferEntryService.create).not.toHaveBeenCalled();
      expect(
        mockJournalEntryRectificationService.rectify
      ).not.toHaveBeenCalled();
      expect(mockFxCostBasisLotService.dispose).not.toHaveBeenCalled();
      expect(mockFxCostBasisLotService.acquire).not.toHaveBeenCalled();
    }
  );
});
