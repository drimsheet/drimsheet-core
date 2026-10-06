import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import makeJournalEntryService from '@domain/journal-entry/services/journal-entry.service';
import {
  EJournalEntryRectificationMode,
  IJournalEntryRectificationResult,
  UJournalEntryRectificationMode,
} from '@domain/journal-entry/types/journal-entry-rectification.types';
import {
  EJournalEntrySourceType,
  IJournalEntry,
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
import mockCounterpartyAppService from '@app/counterparty/contracts/__mocks__/counterparty.service.mock';
import {
  mockJournalEntryRectificationService,
  mockJournalEntryService,
} from '@app/journal-entry/contracts/__mocks__/journal-entry.domain.services.mock';
import {
  IPaymentJournalEntryRectificationReq,
  IReceiptJournalEntryRectificationReq,
  ITransferJournalEntryRectificationReq,
} from '@app/journal-entry/dtos/journal-entry-rectification/journal-entry-rectification.dto';
import makeJournalEntryRectificationPreparationService from '@app/journal-entry/services/journal-entry-rectification-preparation.service';
import {
  mockLedgerAccountBalanceRepo,
  mockLedgerAccountRepo,
} from '@app/ledger/contracts/__mocks__/ledger.repos.mock';
import mockFxLotAppService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-lot.service.mock';

describe('makeJournalEntryRectificationPreparationService', () => {
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
  const counterparty = { name: 'Counterparty' };
  const actor = userId;
  const service = makeJournalEntryRectificationPreparationService({
    counterpartyAppService: mockCounterpartyAppService,
    journalEntryService: mockJournalEntryService,
    journalEntryRectificationService: mockJournalEntryRectificationService,
    ledgerAccountRepo: mockLedgerAccountRepo,
    fxLotAppService: mockFxLotAppService,
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
    mockCounterpartyAppService.findOrCreateMany.mockResolvedValue(new Map());
    mockCounterpartyAppService.getFoundOrCreated.mockReturnValue(undefined);
    mockJournalEntryRectificationService.rectify.mockImplementation(
      async ({ originalEntry, newEntry }) =>
        makeRectificationResult(originalEntry, newEntry as IJournalEntry)
    );
    mockFxLotAppService.reverse.mockResolvedValue(null);
    mockFxLotAppService.dispose.mockResolvedValue(null);
    mockFxLotAppService.acquire.mockResolvedValue(null);
    mockLedgerAccountRepo.findById.mockImplementation(async (id) => {
      if (id === sourceAccount.id) return sourceAccount;
      if (id === destinationAccount.id) return destinationAccount;
      if (id === chargeAccount.id) return chargeAccount;
      return null;
    });
  });

  it.each([
    [null, null, 'draft'],
    [null, effectiveDate, 'active'],
    [effectiveDate, null, 'active'],
    [effectiveDate, effectiveDate, 'active'],
  ] as const)(
    'prepares payment counterparties for effective posting state %s / %s',
    async (originalPostedAt, requestedPostedAt, creationStatus) => {
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
          counterparty,
          amount: amountDto,
          exchangeRate: null,
          description: 'Source',
          sequenceOrder: 1,
        },
        destinationLines: [
          {
            id: originalEntry.lines[1].id,
            accountId: destinationAccount.id,
            counterparty,
            amount: amountDto,
            exchangeRate: null,
            description: 'Destination',
            sequenceOrder: 2,
          },
        ],
      };
      mockJournalEntryService.createPayment.mockResolvedValue(candidate);

      const result = await service.prepare(
        {
          originalEntry,
          requestedEntry,
          accountingEntity,

          actor,
        },
        repoOptions
      );

      expect(mockCounterpartyAppService.findOrCreateMany.mock.calls[0][3]).toBe(
        creationStatus
      );
      expect(mockJournalEntryService.createPayment).toHaveBeenCalledTimes(1);
      expect(mockJournalEntryService.createPayment).toHaveBeenCalledWith(
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
        counterparty,
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
      mockJournalEntryService.createReceipt.mockResolvedValue(candidate);
      mockJournalEntryService.createTransfer.mockResolvedValue({
        journalEntry: candidate,
        destinationAssetAccount: destinationAccount,
      });
      await service.prepare(
        { originalEntry, requestedEntry, accountingEntity, actor },
        repoOptions
      );
      expect(mockCounterpartyAppService.findOrCreateMany.mock.calls[0][3]).toBe(
        postedAt === null ? 'draft' : 'active'
      );
      const creation =
        sourceType === 'receipt'
          ? mockJournalEntryService.createReceipt
          : mockJournalEntryService.createTransfer;
      expect(creation).toHaveBeenCalledWith(
        expect.objectContaining({
          header: expect.objectContaining({ postedAt }),
        }),
        repoOptions
      );
      expect(mockFxLotAppService.acquire).not.toHaveBeenCalled();
      expect(mockFxLotAppService.dispose).not.toHaveBeenCalled();
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
          mockCounterpartyAppService.getFoundOrCreated.mockReturnValue({
            new: false,
            data: counterpartyEntity.make({
              accountingEntityId,
              createdBy: actor,
              name: 'Draft supplier',
              type: 'organization',
              status: 'draft',
            }),
          });
        }
        const domainService = makeJournalEntryService({
          accountingPeriodService: mockAccountingPeriodService,
          ledgerAccountBalanceRepo: mockLedgerAccountBalanceRepo,
          ledgerAccountRepo: mockLedgerAccountRepo,
        });
        const guardedPreparation =
          makeJournalEntryRectificationPreparationService({
            counterpartyAppService: mockCounterpartyAppService,
            journalEntryService: domainService,
            journalEntryRectificationService:
              mockJournalEntryRectificationService,
            ledgerAccountRepo: mockLedgerAccountRepo,
            fxLotAppService: mockFxLotAppService,
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
            counterparty,
            amount: amountDto,
            exchangeRate: null,
            description: null,
            sequenceOrder: 1,
          },
          destinationLines: [
            {
              accountId: destination.id,
              counterparty,
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
        expect(mockFxLotAppService.reverse).not.toHaveBeenCalled();
        expect(mockFxLotAppService.acquire).not.toHaveBeenCalled();
        expect(mockFxLotAppService.dispose).not.toHaveBeenCalled();
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
          counterparty,
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
        counterparty,
        amount: amountDto,
        exchangeRate: null,
        description: 'Destination',
        sequenceOrder: 2,
      },
    };
    mockJournalEntryService.createReceipt.mockResolvedValue(candidate);
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

    expect(mockJournalEntryService.createReceipt).toHaveBeenCalledTimes(1);
    expect(
      result.rectification.currentJournalEntry.lines.map((line) => line.id)
    ).toEqual(candidate[0].lines.map((line) => line.id));
    expect(mockFxLotAppService.acquire).toHaveBeenCalledWith(
      expect.objectContaining({ account: destinationAccount, actor }),
      repoOptions
    );
    expect(mockFxLotAppService.dispose).not.toHaveBeenCalled();
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
          counterparty,
          amount: amountDto,
          exchangeRate: null,
          description: 'Charge with counterparty',
          sequenceOrder: 3,
        },
        {
          accountId: chargeAccount.id,
          counterparty: null,
          amount: amountDto,
          exchangeRate: null,
          description: 'Charge without counterparty',
          sequenceOrder: 4,
        },
      ],
    };
    mockJournalEntryService.createTransfer.mockResolvedValue({
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

    expect(mockJournalEntryService.createTransfer).toHaveBeenCalledTimes(1);
    expect(
      result.rectification.currentJournalEntry.lines.map((line) => line.id)
    ).toEqual(candidate[0].lines.map((line) => line.id));
    expect(mockFxLotAppService.dispose).toHaveBeenCalledTimes(1);
    expect(mockFxLotAppService.acquire).toHaveBeenCalledTimes(1);
    expect(
      mockFxLotAppService.dispose.mock.invocationCallOrder[0]
    ).toBeLessThan(mockFxLotAppService.acquire.mock.invocationCallOrder[0]);
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

    expect(mockJournalEntryService.createPayment).not.toHaveBeenCalled();
    expect(mockJournalEntryService.createReceipt).not.toHaveBeenCalled();
    expect(mockJournalEntryService.createTransfer).not.toHaveBeenCalled();
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
        counterparty,
        amount: amountDto,
        exchangeRate: null,
        description: 'Source',
        sequenceOrder: 1,
      },
      destinationLines: [
        {
          accountId: destinationAccount.id,
          counterparty,
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
    mockJournalEntryService.createPayment.mockResolvedValue([
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
    ).resolves.toMatchObject({ rectification });

    expect(mockFxLotAppService.reverse).toHaveBeenCalledWith(
      originalEntry.id,
      actor,
      repoOptions
    );
    expect(mockFxLotAppService.dispose).toHaveBeenCalledWith(
      {
        journalEntry: correctedEntry,
        account: sourceAccount,
        actor,
      },
      repoOptions
    );
    expect(
      mockFxLotAppService.reverse.mock.invocationCallOrder[0]
    ).toBeLessThan(mockFxLotAppService.dispose.mock.invocationCallOrder[0]);
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
        counterparty,
        amount: amountDto,
        exchangeRate: null,
        description: 'Source',
        sequenceOrder: 1,
      },
      destinationLines: [
        {
          accountId: destinationAccount.id,
          counterparty,
          amount: amountDto,
          exchangeRate: null,
          description: 'Destination',
          sequenceOrder: 2,
        },
      ],
    };
    mockJournalEntryService.createPayment.mockResolvedValue([
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
    mockFxLotAppService.reverse.mockRejectedValue(failure);

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

    expect(mockFxLotAppService.dispose).not.toHaveBeenCalled();
    expect(mockFxLotAppService.acquire).not.toHaveBeenCalled();
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
        counterparty,
        amount: amountDto,
        exchangeRate: null,
        description: 'Source',
        sequenceOrder: 1,
      },
      destinationLines: [
        {
          accountId: destinationAccount.id,
          counterparty,
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
    mockJournalEntryService.createPayment.mockResolvedValue([
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

    expect(mockFxLotAppService.reverse).not.toHaveBeenCalled();
    expect(mockFxLotAppService.dispose).toHaveBeenCalledWith(
      {
        journalEntry: postedEntry,
        account: sourceAccount,
        actor,
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
        counterparty,
        amount: amountDto,
        exchangeRate: null,
        description: 'Source',
        sequenceOrder: 1,
      },
      destinationLines: [
        {
          accountId: destinationAccount.id,
          counterparty,
          amount: amountDto,
          exchangeRate: null,
          description: 'Destination',
          sequenceOrder: 2,
        },
      ],
    };
    mockJournalEntryService.createPayment.mockResolvedValue([
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

    expect(mockFxLotAppService.dispose).not.toHaveBeenCalled();
    expect(mockFxLotAppService.acquire).not.toHaveBeenCalled();
  });
});
