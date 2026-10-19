import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
  IJournalEntry,
  UJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import {
  EAssetAccountBehavior,
  EAssetSubType,
} from '@domain/ledger/types/asset-account.types';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerAccountStatus,
  ELedgerType,
  ENormalBalance,
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import { EExchangeRateType } from '@domain/money/types/exchange-rate.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';
import moneyValue from '@domain/money/values/money.vo';
import fxCostBasisLotAcquisitionEntity from '@domain/subledger/fx-cost-basis/entities/acquisition.entity';
import fxCostBasisLotDispositionAllocationEntity from '@domain/subledger/fx-cost-basis/entities/disposition-allocation.entity';
import fxCostBasisLotDispositionEntity from '@domain/subledger/fx-cost-basis/entities/disposition.entity';
import fxCostBasisLotEntity from '@domain/subledger/fx-cost-basis/entities/lot.entity';
import fxCostBasisLotError from '@domain/subledger/fx-cost-basis/errors/lot.error';
import IFxCostBasisLotAcquisitionRepo from '@domain/subledger/fx-cost-basis/repos/acquisition.repo';
import IFxCostBasisLotDispositionAllocationRepo from '@domain/subledger/fx-cost-basis/repos/disposition-allocation.repo';
import IFxCostBasisLotDispositionRepo from '@domain/subledger/fx-cost-basis/repos/disposition.repo';
import IFxCostBasisLotRepo from '@domain/subledger/fx-cost-basis/repos/lot.repo';
import makeFxCostBasisLotService from '@domain/subledger/fx-cost-basis/services/lot.service';
import { IFxCostBasisDispositionResult } from '@domain/subledger/fx-cost-basis/types/lot.service.types';
import { EFxCostBasisLotStatus } from '@domain/subledger/fx-cost-basis/types/lot.types';

// Keep real entity behavior by default; allow one contract test to supply a nullable audit.
jest.mock('@domain/subledger/fx-cost-basis/entities/lot.entity', () => {
  const actual = jest.requireActual<
    typeof import('@domain/subledger/fx-cost-basis/entities/lot.entity')
  >('@domain/subledger/fx-cost-basis/entities/lot.entity');
  return { ...actual, __esModule: true, default: { ...actual.default } };
});

const mockFxCostBasisLotRepo: jest.Mocked<IFxCostBasisLotRepo> = {
  findById: jest.fn(),
  findOpenByAccountId: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};
const mockAcquisitionRepo: jest.Mocked<IFxCostBasisLotAcquisitionRepo> = {
  create: jest.fn(),
  findByJournalEntryId: jest.fn(),
};
const mockDispositionRepo: jest.Mocked<IFxCostBasisLotDispositionRepo> = {
  create: jest.fn(),
  findByJournalEntryId: jest.fn(),
};
const mockDispositionAllocationRepo: jest.Mocked<IFxCostBasisLotDispositionAllocationRepo> =
  {
    create: jest.fn(),
    findAllByDispositionId: jest.fn(),
  };

describe('makeFxCostBasisLotService', () => {
  const date = new Date('2026-08-01T00:00:00.000Z');
  const entityId = generateUUID();
  const accountId = generateUUID();
  const userId = generateUUID();
  const rate = {
    currencyPair: 'USD/NGN',
    baseCurrencyCode: 'USD',
    targetCurrencyCode: 'NGN',
    rate: 1500,
    type: EExchangeRateType.Negotiated,
    asOf: date,
    source: 'bank',
    createdAt: date,
  };
  const account: ILedgerAccount = {
    id: accountId,
    version: 1,
    code: '100001',
    materializedPath: '100.100001',
    accountingEntityId: entityId,
    type: ELedgerType.Asset,
    normalBalance: ENormalBalance.Debit,
    subType: EAssetSubType.CashAndCashEquivalent,
    behavior: EAssetAccountBehavior.Bank,
    isControlAccount: false,
    controlAccountId: generateUUID(),
    name: 'USD bank',
    currency: SYSTEM_CURRENCIES.USD,
    status: ELedgerAccountStatus.Active,
    contraAccountRule: EContraAccountRule.ContraPermitted,
    adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
    meta: null,
    openingBalanceDate: null,
    createdBy: userId,
    createdAt: date,
    updatedAt: date,
    deletedAt: null,
  };

  function makeJournal(
    side: typeof EJournalSide.Debit | typeof EJournalSide.Credit,
    status: UJournalEntryStatus = EJournalEntryStatus.Posted,
    quantity = moneyValue.make(100, SYSTEM_CURRENCIES.USD, false)
  ): IJournalEntry {
    const functionalAmount = moneyValue.convert(
      quantity,
      rate,
      SYSTEM_CURRENCIES.NGN
    );
    const id = generateUUID();
    return {
      id,
      accountingEntityId: entityId,
      sourceType: EJournalEntrySourceType.Payment,
      memo: null,
      status,
      effectiveDate: date,
      postedAt: status === EJournalEntryStatus.Posted ? date : null,
      voidedAt: null,
      voidingEntryId: null,
      version: 1,
      createdBy: userId,
      createdAt: date,
      updatedAt: date,
      attachments: [],
      lines: [
        {
          createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
          id: generateUUID(),
          entryId: id,
          accountId,
          counterpartyId: null,
          sequenceOrder: 1,
          amount: quantity,
          exchangeRate: rate,
          functionalAmount,
          side,
          description: null,
          meta: null,
          version: 1,
          createdAt: date,
          updatedAt: date,
        },
      ],
    };
  }

  const service = makeFxCostBasisLotService({
    lotRepo: mockFxCostBasisLotRepo,
    acquisitionRepo: mockAcquisitionRepo,
    dispositionRepo: mockDispositionRepo,
    dispositionAllocationRepo: mockDispositionAllocationRepo,
  });

  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());

  describe('zero-rounded functional amounts', () => {
    const repoOptions = { correlationId: 'zero-rounded-fx' };
    const [foreignAccount] = ledgerAccountEntity.make(account);

    function makePayload(
      cents: bigint,
      conversionRate: number,
      side: typeof EJournalSide.Debit | typeof EJournalSide.Credit
    ) {
      const quantity = moneyValue.make(cents, SYSTEM_CURRENCIES.USD, true);
      const exchangeRate = exchangeRateValue.make({
        baseCurrencyCode: 'USD',
        targetCurrencyCode: 'JPY',
        rate: conversionRate,
        type: EExchangeRateType.Negotiated,
        asOf: date,
        source: 'bank',
      });
      const functionalAmount = moneyValue.convert(
        quantity,
        exchangeRate,
        SYSTEM_CURRENCIES.JPY
      );
      const [journalEntry] = journalEntryEntity.make({
        accountingEntityId: entityId,
        memo: null,
        sourceType: EJournalEntrySourceType.OpeningBalance,
        effectiveDate: date,
        postedAt: date,
        createdBy: userId,
        functionalCurrency: SYSTEM_CURRENCIES.JPY,
        lines: [
          {
            accountId: foreignAccount.id,
            sequenceOrder: 1,
            amount: quantity,
            functionalCurrency: SYSTEM_CURRENCIES.JPY,
            exchangeRate,
            side,
            description: null,
          },
          {
            accountId: generateUUID(),
            sequenceOrder: 2,
            amount: functionalAmount,
            functionalCurrency: SYSTEM_CURRENCIES.JPY,
            exchangeRate: null,
            side:
              side === EJournalSide.Debit
                ? EJournalSide.Credit
                : EJournalSide.Debit,
            description: null,
          },
        ],
      });

      return {
        createdBy: userId,
        journalEntry,
        account: foreignAccount,
        officialRate: null,
      };
    }

    function expectReconciled(disposal: IFxCostBasisDispositionResult) {
      const [disposition] = disposal.disposition;
      for (const field of [
        'quantity',
        'costBasisConsumed',
        'proceeds',
        'realizedGainLoss',
      ] as const) {
        expect(
          moneyValue.add(
            ...disposal.allocations.map((allocation) => allocation[field])
          )
        ).toEqual(disposition[field]);
      }
      for (const movement of [disposition, ...disposal.allocations]) {
        expect(movement.realizedGainLoss).toEqual(
          moneyValue.subtract(movement.proceeds, movement.costBasisConsumed)
        );
      }
    }

    it('closes a positive residual quantity whose stored basis is zero', async () => {
      const acquisition = service.acquire(
        makePayload(101n, 99, EJournalSide.Debit)
      )!;
      const [originalLot] = acquisition.lot;
      expect(originalLot.costBasis.amount).toBe(99n);
      mockFxCostBasisLotRepo.findOpenByAccountId.mockResolvedValue([
        originalLot,
      ]);

      const partial = (await service.dispose(
        makePayload(100n, 99, EJournalSide.Credit),
        repoOptions
      ))!;
      const [remainingLot] = partial.lots[0];
      expect(partial.disposition[0].costBasisConsumed.amount).toBe(99n);
      expect(remainingLot.remainingQuantity.amount).toBe(1n);
      expect(remainingLot.remainingCostBasis.amount).toBe(0n);
      expect(remainingLot.status).toBe(EFxCostBasisLotStatus.Open);
      expectReconciled(partial);
      mockFxCostBasisLotRepo.findOpenByAccountId.mockResolvedValue([
        remainingLot,
      ]);

      const closing = (await service.dispose(
        makePayload(1n, 150, EJournalSide.Credit),
        repoOptions
      ))!;
      const [closedLot, events, audit] = closing.lots[0];
      expect(closedLot.status).toBe(EFxCostBasisLotStatus.Closed);
      expect(closedLot.remainingQuantity.amount).toBe(0n);
      expect(closedLot.remainingCostBasis.amount).toBe(0n);
      expect(closing.disposition[0]).toMatchObject({
        costBasisConsumed: { amount: 0n },
        proceeds: { amount: 1n },
        realizedGainLoss: { amount: 1n },
      });
      expectReconciled(closing);
      expect(events).toHaveLength(1);
      expect(events[0].data).toEqual(closedLot);
      expect(audit.action).toBe('closed');
      expect(audit.diff).toEqual({ before: remainingLot, after: closedLot });
      expect(originalLot.remainingQuantity.amount).toBe(101n);
      expect(originalLot.remainingCostBasis.amount).toBe(99n);
      expect(remainingLot.remainingQuantity.amount).toBe(1n);
    });

    it('creates zero-proceeds allocations and assigns the residual to the final allocation', async () => {
      const first = service.acquire(makePayload(1n, 150, EJournalSide.Debit))!;
      const second = service.acquire(
        makePayload(100n, 150, EJournalSide.Debit)
      )!;
      mockFxCostBasisLotRepo.findOpenByAccountId.mockResolvedValue([
        first.lot[0],
        second.lot[0],
      ]);

      const disposal = (await service.dispose(
        makePayload(2n, 99, EJournalSide.Credit),
        repoOptions
      ))!;

      expect(
        disposal.allocations.map((allocation) => allocation.quantity.amount)
      ).toEqual([1n, 1n]);
      expect(
        disposal.allocations.map(
          (allocation) => allocation.costBasisConsumed.amount
        )
      ).toEqual([1n, 1n]);
      expect(
        disposal.allocations.map((allocation) => allocation.proceeds.amount)
      ).toEqual([0n, 1n]);
      expect(
        disposal.allocations.map(
          (allocation) => allocation.realizedGainLoss.amount
        )
      ).toEqual([-1n, 0n]);
      expect(disposal.disposition[0]).toMatchObject({
        quantity: { amount: 2n },
        costBasisConsumed: { amount: 2n },
        proceeds: { amount: 1n },
        realizedGainLoss: { amount: -1n },
      });
      expect(disposal.lots[0][0].status).toBe(EFxCostBasisLotStatus.Closed);
      expect(disposal.lots[1][0]).toMatchObject({
        remainingQuantity: { amount: 99n },
        remainingCostBasis: { amount: 149n },
      });
      expectReconciled(disposal);
    });

    it.each([
      { acquisitionRate: 99, dispositionRate: 150, basis: 0n, proceeds: 1n },
      { acquisitionRate: 150, dispositionRate: 99, basis: 1n, proceeds: 0n },
      { acquisitionRate: 99, dispositionRate: 99, basis: 0n, proceeds: 0n },
    ])(
      'acquires and closes a cent with basis $basis and proceeds $proceeds JPY',
      async (scenario) => {
        const acquisition = service.acquire(
          makePayload(1n, scenario.acquisitionRate, EJournalSide.Debit)
        )!;
        expect(acquisition.lot[0].costBasis.amount).toBe(scenario.basis);
        expect(acquisition.acquisition[0].costBasis.amount).toBe(
          scenario.basis
        );
        mockFxCostBasisLotRepo.findOpenByAccountId.mockResolvedValue([
          acquisition.lot[0],
        ]);

        const disposal = (await service.dispose(
          makePayload(1n, scenario.dispositionRate, EJournalSide.Credit),
          repoOptions
        ))!;

        expect(disposal.disposition[0]).toMatchObject({
          costBasisConsumed: { amount: scenario.basis },
          proceeds: { amount: scenario.proceeds },
          realizedGainLoss: { amount: scenario.proceeds - scenario.basis },
        });
        expect(disposal.lots[0][0]).toMatchObject({
          status: EFxCostBasisLotStatus.Closed,
          remainingQuantity: { amount: 0n },
          remainingCostBasis: { amount: 0n },
        });
        expectReconciled(disposal);
      }
    );

    it('consumes zero partial basis and preserves the exact basis for closure', async () => {
      const acquisition = service.acquire(
        makePayload(101n, 99, EJournalSide.Debit)
      )!;
      mockFxCostBasisLotRepo.findOpenByAccountId.mockResolvedValue([
        acquisition.lot[0],
      ]);
      const partial = (await service.dispose(
        makePayload(1n, 150, EJournalSide.Credit),
        repoOptions
      ))!;

      expect(partial.disposition[0].costBasisConsumed.amount).toBe(0n);
      expect(partial.disposition[0].proceeds.amount).toBe(1n);
      expect(partial.lots[0][0]).toMatchObject({
        status: EFxCostBasisLotStatus.Open,
        remainingQuantity: { amount: 100n },
        remainingCostBasis: { amount: 99n },
      });
      expectReconciled(partial);
      mockFxCostBasisLotRepo.findOpenByAccountId.mockResolvedValue([
        partial.lots[0][0],
      ]);
      const closing = (await service.dispose(
        makePayload(100n, 99, EJournalSide.Credit),
        repoOptions
      ))!;

      expect(closing.disposition[0].costBasisConsumed.amount).toBe(99n);
      expect(closing.lots[0][0]).toMatchObject({
        status: EFxCostBasisLotStatus.Closed,
        remainingQuantity: { amount: 0n },
        remainingCostBasis: { amount: 0n },
      });
      expectReconciled(closing);
    });

    it('reverses a zero-basis acquisition without changing its original records', async () => {
      const acquisition = service.acquire(
        makePayload(1n, 99, EJournalSide.Debit)
      )!;
      const [lot] = acquisition.lot;
      const [record] = acquisition.acquisition;
      mockAcquisitionRepo.findByJournalEntryId.mockResolvedValue(record);
      mockDispositionRepo.findByJournalEntryId.mockResolvedValue(null);
      mockFxCostBasisLotRepo.findById.mockResolvedValue(lot);

      const reversal = (await service.reverse(
        record.journalEntryId,
        repoOptions
      ))!;
      const [reversed, events, audit] = reversal.lots[0];

      expect(reversed).toMatchObject({
        status: EFxCostBasisLotStatus.Closed,
        remainingQuantity: { amount: 0n },
        remainingCostBasis: { amount: 0n },
      });
      expect(events[0].data).toEqual(reversed);
      expect(audit.action).toBe('reversed');
      expect(audit.diff).toEqual({ before: lot, after: reversed });
      expect(lot.remainingQuantity.amount).toBe(1n);
      expect(record.quantity.amount).toBe(1n);
      expect(record.costBasis.amount).toBe(0n);
    });

    it('restores the exact zero basis when reversing a disposition', async () => {
      const acquisition = service.acquire(
        makePayload(1n, 99, EJournalSide.Debit)
      )!;
      const [lot] = acquisition.lot;
      mockFxCostBasisLotRepo.findOpenByAccountId.mockResolvedValue([lot]);
      const disposal = (await service.dispose(
        makePayload(1n, 150, EJournalSide.Credit),
        repoOptions
      ))!;
      const [closed] = disposal.lots[0];
      const [disposition] = disposal.disposition;
      mockAcquisitionRepo.findByJournalEntryId.mockResolvedValue(null);
      mockDispositionRepo.findByJournalEntryId.mockResolvedValue(disposition);
      mockDispositionAllocationRepo.findAllByDispositionId.mockResolvedValue(
        disposal.allocations
      );
      mockFxCostBasisLotRepo.findById.mockResolvedValue(closed);

      const reversal = (await service.reverse(
        disposition.journalEntryId,
        repoOptions
      ))!;
      const [restored, events, audit] = reversal.lots[0];

      expect(restored).toMatchObject({
        status: EFxCostBasisLotStatus.Open,
        remainingQuantity: lot.remainingQuantity,
        remainingCostBasis: lot.remainingCostBasis,
      });
      expect(events[0].data).toEqual(restored);
      expect(audit.action).toBe('reversed');
      expect(audit.diff).toEqual({ before: closed, after: restored });
      expect(closed.remainingQuantity.amount).toBe(0n);
      expect(disposition.costBasisConsumed.amount).toBe(0n);
      expect(disposition.proceeds.amount).toBe(1n);
      expect(disposal.allocations[0].costBasisConsumed.amount).toBe(0n);
    });
  });

  it('derives an acquisition from the completed journal and account', () => {
    const journalEntry = makeJournal(EJournalSide.Debit);
    const officialRate = {
      ...rate,
      type: EExchangeRateType.Official,
    };
    const result = service.acquire({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      journalEntry,
      account,
      officialRate,
    });

    expect(result?.lot[0]).toMatchObject({
      ledgerAccountId: account.id,
      accountingEntityId: entityId,
      originalQuantity: journalEntry.lines[0].amount,
      costBasis: journalEntry.lines[0].functionalAmount,
      acquisitionRate: rate,
      acquisitionDate: date,
    });
    expect(result?.acquisition[0].journalEntryId).toBe(journalEntry.id);
    expect(result?.acquisition[0].officialRate).toBe(officialRate);
  });

  it('permits foreign petty-cash movements for FX cost-basis tracking', () => {
    const pettyCashAccount = {
      ...account,
      behavior: EAssetAccountBehavior.PettyCash,
    } as ILedgerAccount;

    const result = service.acquire({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      journalEntry: makeJournal(EJournalSide.Debit),
      account: pettyCashAccount,
      officialRate: null,
    });

    expect(result).not.toBeNull();
  });

  it.each([
    [SYSTEM_CURRENCIES.USD, 100n, 150, SYSTEM_CURRENCIES.JPY, 150n],
    [SYSTEM_CURRENCIES.JPY, 150n, 0.006, SYSTEM_CURRENCIES.USD, 90n],
  ])(
    'acquires %o %s at %s with %o %s functional basis',
    (source, amount, conversionRate, target, expected) => {
      const [foreignAccount] = ledgerAccountEntity.make({
        ...account,
        currency: source,
      });
      const [journalEntry] = journalEntryEntity.make({
        accountingEntityId: entityId,
        memo: null,
        sourceType: EJournalEntrySourceType.OpeningBalance,
        effectiveDate: date,
        postedAt: date,
        createdBy: userId,
        functionalCurrency: target,
        lines: [
          {
            accountId: foreignAccount.id,
            sequenceOrder: 1,
            amount: moneyValue.make(amount, source, true),
            functionalCurrency: target,
            exchangeRate: exchangeRateValue.make({
              baseCurrencyCode: source.code,
              targetCurrencyCode: target.code,
              rate: conversionRate,
              type: EExchangeRateType.Negotiated,
              asOf: date,
              source: 'bank',
            }),
            side: EJournalSide.Debit,
            description: null,
          },
          {
            accountId: generateUUID(),
            sequenceOrder: 2,
            amount: moneyValue.make(expected, target, true),
            functionalCurrency: target,
            exchangeRate: null,
            side: EJournalSide.Credit,
            description: null,
          },
        ],
      });

      const acquisition = service.acquire({
        createdBy: userId,
        journalEntry,
        account: foreignAccount,
        officialRate: null,
      });

      const expectedBasis = moneyValue.make(expected, target, true);
      expect(acquisition?.lot[0].costBasis).toEqual(expectedBasis);
      expect(acquisition?.lot[0].remainingCostBasis).toEqual(expectedBasis);
      expect(acquisition?.acquisition[0].costBasis).toEqual(expectedBasis);
    }
  );

  it.each([
    EJournalEntryStatus.Draft,
    EJournalEntryStatus.Voided,
    EJournalEntryStatus.Archived,
  ])('rejects a direct acquisition for a %s journal', (status) => {
    expect(() =>
      service.acquire({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        journalEntry: makeJournal(EJournalSide.Debit, status),
        account,
        officialRate: null,
      })
    ).toThrow(fxCostBasisLotError.InvalidJournalStatus);
    expect(mockFxCostBasisLotRepo.findOpenByAccountId).not.toHaveBeenCalled();
  });

  it.each([
    EJournalEntryStatus.Draft,
    EJournalEntryStatus.Voided,
    EJournalEntryStatus.Archived,
  ])(
    'rejects a direct disposition for a %s journal before reading lots',
    async (status) => {
      await expect(
        service.dispose(
          {
            createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
            journalEntry: makeJournal(EJournalSide.Credit, status),
            account,
            officialRate: null,
          },
          { correlationId: 'corr-id' }
        )
      ).rejects.toBeInstanceOf(fxCostBasisLotError.InvalidJournalStatus);
      expect(mockFxCostBasisLotRepo.findOpenByAccountId).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['functional-currency account', { currency: SYSTEM_CURRENCIES.NGN }],
    ['account without a fixed currency', { currency: null }],
    ['control account', { isControlAccount: true }],
    [
      'non-cash account',
      {
        subType: EAssetSubType.Receivables,
        behavior: null,
      },
    ],
    [
      'cash account with an unsupported behavior',
      { behavior: EAssetAccountBehavior.DefaultCash },
    ],
    [
      'cash account with an unsupported ledger type',
      { type: ELedgerType.Revenue },
    ],
  ])('returns null for a valid %s movement', async (_, accountOverrides) => {
    const candidate = { ...account, ...accountOverrides } as ILedgerAccount;
    const journalEntry = makeJournal(EJournalSide.Credit);
    if (candidate.currency) {
      journalEntry.lines[0] = {
        ...journalEntry.lines[0],
        amount: moneyValue.make(100, candidate.currency, false),
      };
    }

    const result = await service.dispose(
      {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        journalEntry,
        account: candidate,
        officialRate: null,
      },
      { correlationId: 'corr-id' }
    );

    expect(result).toBeNull();
    expect(mockFxCostBasisLotRepo.findOpenByAccountId).not.toHaveBeenCalled();
  });

  it('returns null for a posted functional-currency acquisition candidate', () => {
    const functionalAccount = {
      ...account,
      currency: SYSTEM_CURRENCIES.NGN,
    } as ILedgerAccount;

    const result = service.acquire({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      journalEntry: makeJournal(EJournalSide.Debit),
      account: functionalAccount,
      officialRate: null,
    });

    expect(result).toBeNull();
  });

  it('rejects the wrong journal side for the requested FX operation', () => {
    expect(() =>
      service.acquire({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        journalEntry: makeJournal(EJournalSide.Credit),
        account,
        officialRate: null,
      })
    ).toThrow(fxCostBasisLotError.InvalidJournalSide);
  });

  it.each([
    ['missing', null],
    [
      'wrong currency pair',
      {
        ...rate,
        currencyPair: 'EUR/NGN',
        baseCurrencyCode: 'EUR',
      },
    ],
  ])('rejects a %s transaction rate for an FX movement', (_, exchangeRate) => {
    const journalEntry = makeJournal(EJournalSide.Debit);
    journalEntry.lines[0] = { ...journalEntry.lines[0], exchangeRate };

    expect(() =>
      service.acquire({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        journalEntry,
        account,
        officialRate: null,
      })
    ).toThrow(fxCostBasisLotError.InvalidTransactionRate);
  });

  it('rejects an official rate for a different currency pair', () => {
    expect(() =>
      service.acquire({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        journalEntry: makeJournal(EJournalSide.Debit),
        account,
        officialRate: {
          ...rate,
          currencyPair: 'EUR/NGN',
          baseCurrencyCode: 'EUR',
          type: EExchangeRateType.Official,
        },
      })
    ).toThrow(fxCostBasisLotError.InvalidOfficialRate);
  });

  it('consumes lots in FIFO order and derives disposition totals', async () => {
    const [firstLot] = fxCostBasisLotEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      ledgerAccountId: accountId,
      accountingEntityId: entityId,
      status: EFxCostBasisLotStatus.Open,
      originalQuantity: moneyValue.make(60, SYSTEM_CURRENCIES.USD, false),
      remainingQuantity: moneyValue.make(60, SYSTEM_CURRENCIES.USD, false),
      costBasis: moneyValue.make(84000, SYSTEM_CURRENCIES.NGN, false),
      remainingCostBasis: moneyValue.make(84000, SYSTEM_CURRENCIES.NGN, false),
      acquisitionRate: { ...rate, rate: 1400 },
      acquisitionDate: new Date('2026-07-01T00:00:00.000Z'),
    });
    const [secondLot] = fxCostBasisLotEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      ledgerAccountId: accountId,
      accountingEntityId: entityId,
      status: EFxCostBasisLotStatus.Open,
      originalQuantity: moneyValue.make(50, SYSTEM_CURRENCIES.USD, false),
      remainingQuantity: moneyValue.make(50, SYSTEM_CURRENCIES.USD, false),
      costBasis: moneyValue.make(72500, SYSTEM_CURRENCIES.NGN, false),
      remainingCostBasis: moneyValue.make(72500, SYSTEM_CURRENCIES.NGN, false),
      acquisitionRate: { ...rate, rate: 1450 },
      acquisitionDate: new Date('2026-07-15T00:00:00.000Z'),
    });
    mockFxCostBasisLotRepo.findOpenByAccountId.mockResolvedValue([
      firstLot,
      secondLot,
    ]);
    const journalEntry = makeJournal(EJournalSide.Credit);

    const result = await service.dispose(
      {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        journalEntry,
        account,
        officialRate: null,
      },
      { correlationId: 'corr-id' }
    );

    expect(mockFxCostBasisLotRepo.findOpenByAccountId).toHaveBeenCalledWith(
      entityId,
      accountId,
      { correlationId: 'corr-id' }
    );
    expect(result?.lots).toHaveLength(2);
    expect(result?.allocations).toHaveLength(2);
    expect(result?.disposition[0].proceeds).toEqual(
      journalEntry.lines[0].functionalAmount
    );
    expect(result?.lots[0][0].status).toBe(EFxCostBasisLotStatus.Closed);
  });

  it('rejects a disposition when FIFO quantity is insufficient', async () => {
    mockFxCostBasisLotRepo.findOpenByAccountId.mockResolvedValue([]);

    await expect(
      service.dispose(
        {
          createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
          journalEntry: makeJournal(EJournalSide.Credit),
          account,
          officialRate: null,
        },
        { correlationId: 'corr-id' }
      )
    ).rejects.toBeInstanceOf(fxCostBasisLotError.InsufficientQuantity);
  });

  it('reverses the acquisition created by a journal entry', async () => {
    const journalEntry = makeJournal(EJournalSide.Debit);
    const [lot] = fxCostBasisLotEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      ledgerAccountId: accountId,
      accountingEntityId: entityId,
      status: EFxCostBasisLotStatus.Open,
      originalQuantity: journalEntry.lines[0].amount,
      remainingQuantity: journalEntry.lines[0].amount,
      costBasis: journalEntry.lines[0].functionalAmount,
      remainingCostBasis: journalEntry.lines[0].functionalAmount,
      acquisitionRate: rate,
      acquisitionDate: date,
    });
    const [acquisition] = fxCostBasisLotAcquisitionEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      ledgerAccountId: accountId,
      accountingEntityId: entityId,
      lotId: lot.id,
      journalEntryId: journalEntry.id,
      quantity: lot.originalQuantity,
      costBasis: lot.costBasis,
      acquisitionRate: rate,
      acquisitionDate: date,
      officialRate: null,
    });
    mockAcquisitionRepo.findByJournalEntryId.mockResolvedValue(acquisition);
    mockDispositionRepo.findByJournalEntryId.mockResolvedValue(null);
    mockFxCostBasisLotRepo.findById.mockResolvedValue(lot);

    const result = await service.reverse(journalEntry.id, {
      correlationId: 'corr-id',
    });

    expect(result?.lots[0][0]).toMatchObject({
      id: lot.id,
      status: EFxCostBasisLotStatus.Closed,
      version: 2,
      remainingQuantity: moneyValue.makeZeroAmount(SYSTEM_CURRENCIES.USD),
      remainingCostBasis: moneyValue.makeZeroAmount(SYSTEM_CURRENCIES.NGN),
    });
    expect(result?.lots[0][2].action).toBe('reversed');
  });

  it.each([false, true])(
    'returns only audited disposition reversals: entity reports unchanged=%s',
    async (unchanged) => {
      const journalEntry = makeJournal(EJournalSide.Credit);
      const quantity = journalEntry.lines[0].amount;
      const costBasis = journalEntry.lines[0].functionalAmount;
      const [openLot] = fxCostBasisLotEntity.make({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        ledgerAccountId: accountId,
        accountingEntityId: entityId,
        status: EFxCostBasisLotStatus.Open,
        originalQuantity: quantity,
        remainingQuantity: quantity,
        costBasis,
        remainingCostBasis: costBasis,
        acquisitionRate: rate,
        acquisitionDate: date,
      });
      const [closedLot] = fxCostBasisLotEntity.consume(
        openLot,
        quantity,
        costBasis
      );
      const [disposition] = fxCostBasisLotDispositionEntity.make({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        ledgerAccountId: accountId,
        accountingEntityId: entityId,
        journalEntryId: journalEntry.id,
        quantity,
        costBasisConsumed: costBasis,
        proceeds: costBasis,
        realizedGainLoss: moneyValue.makeZeroAmount(SYSTEM_CURRENCIES.NGN),
        dispositionRate: rate,
        officialRate: null,
        dispositionDate: date,
      });
      const allocation = fxCostBasisLotDispositionAllocationEntity.make({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        dispositionId: disposition.id,
        lotId: closedLot.id,
        quantity,
        costBasisConsumed: costBasis,
        proceeds: costBasis,
        realizedGainLoss: moneyValue.makeZeroAmount(SYSTEM_CURRENCIES.NGN),
      });
      mockAcquisitionRepo.findByJournalEntryId.mockResolvedValue(null);
      mockDispositionRepo.findByJournalEntryId.mockResolvedValue(disposition);
      mockDispositionAllocationRepo.findAllByDispositionId.mockResolvedValue([
        allocation,
      ]);
      mockFxCostBasisLotRepo.findById.mockResolvedValue(closedLot);

      if (unchanged) {
        // Exercise the service's nullable-audit contract without creating an invalid zero allocation.
        jest
          .spyOn(fxCostBasisLotEntity, 'reverseDisposition')
          .mockReturnValueOnce([closedLot, [], null]);
      }
      const result = await service.reverse(journalEntry.id, {
        correlationId: 'corr-id',
      });

      if (unchanged) {
        expect(fxCostBasisLotEntity.reverseDisposition).toHaveBeenCalledWith(
          closedLot,
          allocation.quantity,
          allocation.costBasisConsumed
        );
        expect(result).toBeNull();
        expect(closedLot.version).toBe(2);
        expect(closedLot.remainingQuantity.amount).toBe(0n);
        expect(mockFxCostBasisLotRepo.update).not.toHaveBeenCalled();
        return;
      }

      expect(result?.lots[0][0]).toMatchObject({
        id: closedLot.id,
        status: EFxCostBasisLotStatus.Open,
        version: 3,
        remainingQuantity: quantity,
        remainingCostBasis: costBasis,
      });
    }
  );

  it('rejects an acquisition reversal when its lot is missing', async () => {
    const journalEntry = makeJournal(EJournalSide.Debit);
    const lotId = generateUUID();
    const [acquisition] = fxCostBasisLotAcquisitionEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      ledgerAccountId: accountId,
      accountingEntityId: entityId,
      lotId,
      journalEntryId: journalEntry.id,
      quantity: journalEntry.lines[0].amount,
      costBasis: journalEntry.lines[0].functionalAmount,
      acquisitionRate: rate,
      acquisitionDate: date,
      officialRate: null,
    });
    mockAcquisitionRepo.findByJournalEntryId.mockResolvedValue(acquisition);
    mockDispositionRepo.findByJournalEntryId.mockResolvedValue(null);
    mockFxCostBasisLotRepo.findById.mockResolvedValue(null);
    const repoOptions = { correlationId: 'corr-id' };

    const reversal = service.reverse(journalEntry.id, repoOptions);

    await expect(reversal).rejects.toBeInstanceOf(
      fxCostBasisLotError.LotNotFound
    );
    await expect(reversal).rejects.toMatchObject({
      cause: { journalEntryId: journalEntry.id, lotId },
    });
    expect(mockFxCostBasisLotRepo.findById).toHaveBeenCalledWith(
      lotId,
      repoOptions
    );
    expect(
      mockDispositionAllocationRepo.findAllByDispositionId
    ).not.toHaveBeenCalled();
  });

  it('rejects a disposition reversal when an allocated lot is missing', async () => {
    const journalEntry = makeJournal(EJournalSide.Credit);
    const quantity = journalEntry.lines[0].amount;
    const costBasis = journalEntry.lines[0].functionalAmount;
    const realizedGainLoss = moneyValue.makeZeroAmount(SYSTEM_CURRENCIES.NGN);
    const [disposition] = fxCostBasisLotDispositionEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      ledgerAccountId: accountId,
      accountingEntityId: entityId,
      journalEntryId: journalEntry.id,
      quantity,
      costBasisConsumed: costBasis,
      proceeds: costBasis,
      realizedGainLoss,
      dispositionRate: rate,
      officialRate: null,
      dispositionDate: date,
    });
    const allocation = fxCostBasisLotDispositionAllocationEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      dispositionId: disposition.id,
      lotId: generateUUID(),
      quantity,
      costBasisConsumed: costBasis,
      proceeds: costBasis,
      realizedGainLoss,
    });
    mockAcquisitionRepo.findByJournalEntryId.mockResolvedValue(null);
    mockDispositionRepo.findByJournalEntryId.mockResolvedValue(disposition);
    mockDispositionAllocationRepo.findAllByDispositionId.mockResolvedValue([
      allocation,
    ]);
    mockFxCostBasisLotRepo.findById.mockResolvedValue(null);
    const repoOptions = { correlationId: 'corr-id' };

    const reversal = service.reverse(journalEntry.id, repoOptions);

    await expect(reversal).rejects.toBeInstanceOf(
      fxCostBasisLotError.LotNotFound
    );
    await expect(reversal).rejects.toMatchObject({
      cause: { journalEntryId: journalEntry.id, lotId: allocation.lotId },
    });
    expect(
      mockDispositionAllocationRepo.findAllByDispositionId
    ).toHaveBeenCalledWith(disposition.id, repoOptions);
    expect(mockFxCostBasisLotRepo.findById).toHaveBeenCalledWith(
      allocation.lotId,
      repoOptions
    );
  });

  it('returns null when a journal entry has no FX lot effect', async () => {
    mockAcquisitionRepo.findByJournalEntryId.mockResolvedValue(null);
    mockDispositionRepo.findByJournalEntryId.mockResolvedValue(null);

    await expect(
      service.reverse(generateUUID(), { correlationId: 'corr-id' })
    ).resolves.toBeNull();
  });
});
