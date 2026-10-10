import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
  IJournalEntry,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
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
import {
  EExchangeRateType,
  IExchangeRate,
} from '@domain/money/types/exchange-rate.types';
import moneyValue from '@domain/money/values/money.vo';
import fxCostBasisLotAcquisitionEntity from '@domain/subledger/fx-cost-basis/entities/acquisition.entity';
import fxCostBasisLotDispositionEntity from '@domain/subledger/fx-cost-basis/entities/disposition.entity';
import fxCostBasisLotEntity from '@domain/subledger/fx-cost-basis/entities/lot.entity';
import { EFxCostBasisLotStatus } from '@domain/subledger/fx-cost-basis/types/lot.types';

import mockExchangeRateAppService from '@app/money/contracts/__mocks__/exchange-rate.service.mock';
import { EMissingOfficialFxRateEffectKind } from '@app/outbox/types/missing-official-fx-rate.types';
import { mockFxCostBasisLotService } from '@app/subledger/contracts/__mocks__/subledger.domain.services.mock';
import makeFxLotAppService from '@app/subledger/fx-cost-basis/services/fx-lot.service';

describe('fxLotAppService', () => {
  const correlationId = 'fx-lot-app-correlation-id';
  const date = new Date('2026-08-01T00:00:00.000Z');
  const accountingEntityId = generateUUID();
  const accountId = generateUUID();
  const userId = generateUUID();
  const actor = userId;
  const transactionRate: IExchangeRate = {
    currencyPair: 'USD/NGN',
    baseCurrencyCode: 'USD',
    targetCurrencyCode: 'NGN',
    rate: 1500,
    type: EExchangeRateType.Negotiated,
    asOf: date,
    source: 'bank',
    createdAt: date,
  };
  const officialRate: IExchangeRate = {
    ...transactionRate,
    type: EExchangeRateType.Official,
    source: 'central-bank',
  };
  const account: ILedgerAccount = {
    id: accountId,
    version: 1,
    code: '100001',
    materializedPath: '100.100001',
    accountingEntityId,
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
    status:
      | typeof EJournalEntryStatus.Draft
      | typeof EJournalEntryStatus.Posted,
    side: typeof EJournalSide.Debit | typeof EJournalSide.Credit,
    exchangeRate: IExchangeRate | null = transactionRate
  ): IJournalEntry {
    const id = generateUUID();
    const amount = moneyValue.make(100, SYSTEM_CURRENCIES.USD, false);

    return {
      id,
      accountingEntityId,
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
          amount,
          exchangeRate,
          functionalAmount: moneyValue.make(
            150000,
            SYSTEM_CURRENCIES.NGN,
            false
          ),
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

  function makeAcquisitionResult(
    journalEntry: IJournalEntry,
    rate: IExchangeRate | null
  ) {
    const lot = fxCostBasisLotEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      ledgerAccountId: accountId,
      accountingEntityId,
      status: EFxCostBasisLotStatus.Open,
      originalQuantity: journalEntry.lines[0].amount,
      remainingQuantity: journalEntry.lines[0].amount,
      costBasis: journalEntry.lines[0].functionalAmount,
      remainingCostBasis: journalEntry.lines[0].functionalAmount,
      acquisitionRate: transactionRate,
      acquisitionDate: date,
    });
    const acquisition = fxCostBasisLotAcquisitionEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      ledgerAccountId: accountId,
      accountingEntityId,
      lotId: lot[0].id,
      journalEntryId: journalEntry.id,
      quantity: journalEntry.lines[0].amount,
      costBasis: journalEntry.lines[0].functionalAmount,
      acquisitionRate: transactionRate,
      acquisitionDate: date,
      officialRate: rate,
    });

    return { lot, acquisition };
  }

  function makeDispositionResult(
    journalEntry: IJournalEntry,
    rate: IExchangeRate | null
  ) {
    const [lot] = makeAcquisitionResult(journalEntry, rate).lot;
    const consumedLot = fxCostBasisLotEntity.consume(
      lot,
      lot.remainingQuantity,
      lot.remainingCostBasis
    );
    const disposition = fxCostBasisLotDispositionEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      ledgerAccountId: accountId,
      accountingEntityId,
      journalEntryId: journalEntry.id,
      quantity: journalEntry.lines[0].amount,
      costBasisConsumed: journalEntry.lines[0].functionalAmount,
      proceeds: journalEntry.lines[0].functionalAmount,
      realizedGainLoss: moneyValue.makeZeroAmount(SYSTEM_CURRENCIES.NGN),
      dispositionRate: transactionRate,
      officialRate: rate,
      dispositionDate: date,
    });

    return { lots: [consumedLot], disposition, allocations: [] };
  }

  const service = makeFxLotAppService({
    fxCostBasisLotService: mockFxCostBasisLotService,
    exchangeRateAppService: mockExchangeRateAppService,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockExchangeRateAppService.getOfficialRate.mockResolvedValue(officialRate);
  });

  it('prepares versioned histories for an FX lot reversal', async () => {
    const journalEntry = makeJournal(
      EJournalEntryStatus.Posted,
      EJournalSide.Debit
    );
    const [lot] = makeAcquisitionResult(journalEntry, officialRate).lot;
    const reversedLot = fxCostBasisLotEntity.reverseAcquisition(
      lot,
      lot.remainingQuantity,
      lot.remainingCostBasis
    );
    mockFxCostBasisLotService.reverse.mockResolvedValue({
      lots: [reversedLot],
    });

    const result = await service.reverse(journalEntry.id, actor, {
      correlationId,
    });

    expect(mockFxCostBasisLotService.reverse).toHaveBeenCalledWith(
      journalEntry.id,
      { correlationId }
    );
    expect(result?.records.lots[0]).toMatchObject({
      lot: reversedLot[0],
      expectedVersion: lot.version,
      history: { actorId: actor, correlationId, action: 'reversed' },
    });
    expect(result?.events).toEqual(reversedLot[1]);
  });

  it('returns null when there is no FX lot effect to reverse', async () => {
    const journalEntryId = generateUUID();
    mockFxCostBasisLotService.reverse.mockResolvedValue(null);

    await expect(
      service.reverse(journalEntryId, actor, { correlationId })
    ).resolves.toBeNull();
  });

  it('returns null for draft acquisitions and dispositions before dependency calls', async () => {
    const draftAcquisition = makeJournal(
      EJournalEntryStatus.Draft,
      EJournalSide.Debit
    );
    const draftDisposition = makeJournal(
      EJournalEntryStatus.Draft,
      EJournalSide.Credit
    );

    await expect(
      service.acquire(
        { journalEntry: draftAcquisition, account, actor },
        { correlationId }
      )
    ).resolves.toBeNull();
    await expect(
      service.dispose(
        { journalEntry: draftDisposition, account, actor },
        { correlationId }
      )
    ).resolves.toBeNull();

    expect(mockExchangeRateAppService.getOfficialRate).not.toHaveBeenCalled();
    expect(mockFxCostBasisLotService.acquire).not.toHaveBeenCalled();
    expect(mockFxCostBasisLotService.dispose).not.toHaveBeenCalled();
  });

  it('prepares a rated acquisition with histories and ordered events', async () => {
    const journalEntry = makeJournal(
      EJournalEntryStatus.Posted,
      EJournalSide.Debit
    );
    const domainResult = makeAcquisitionResult(journalEntry, officialRate);
    mockFxCostBasisLotService.acquire.mockReturnValue(domainResult);

    const result = await service.acquire(
      { journalEntry, account, actor },
      { correlationId }
    );

    expect(mockExchangeRateAppService.getOfficialRate).toHaveBeenCalledWith(
      transactionRate.currencyPair,
      transactionRate.asOf,
      { correlationId },
      transactionRate
    );
    expect(mockFxCostBasisLotService.acquire).toHaveBeenCalledWith({
      createdBy: actor,
      journalEntry,
      account,
      officialRate,
    });
    expect(result?.records).toMatchObject({
      lot: domainResult.lot[0],
      acquisition: domainResult.acquisition[0],
      lotHistory: { actorId: actor, correlationId },
      acquisitionHistory: { actorId: actor, correlationId },
      missingOfficialRateOutbox: null,
    });
    expect(result?.events).toEqual([
      ...domainResult.lot[1],
      ...domainResult.acquisition[1],
    ]);
  });

  it.each([
    actor,
    accountingEntityId,
    'b2222222-2222-4222-8222-222222222222' as TEntityId,
    'c3333333-3333-4333-8333-333333333333' as TEntityId,
  ])(
    'preserves the $type actor in the missing-rate outbox and histories',
    async (actor) => {
      const journalEntry = makeJournal(
        EJournalEntryStatus.Posted,
        EJournalSide.Debit,
        null
      );
      const domainResult = makeAcquisitionResult(journalEntry, null);
      mockExchangeRateAppService.getOfficialRate.mockResolvedValue(null);
      mockFxCostBasisLotService.acquire.mockReturnValue(domainResult);

      const result = await service.acquire(
        { journalEntry, account, actor },
        { correlationId }
      );

      expect(mockExchangeRateAppService.getOfficialRate).not.toHaveBeenCalled();
      expect(result?.records.missingOfficialRateOutbox).toEqual({
        id: domainResult.acquisition[0].id,
        correlationId,
        type: 'missing_official_fx_rate',
        data: {
          effectKind: EMissingOfficialFxRateEffectKind.Acquisition,
          journalEntryId: journalEntry.id,
          accountingEntityId,
          createdBy: actor,
          effectiveDate: date,
        },
      });
    }
  );

  it('passes through a posted no-effect acquisition result', async () => {
    const journalEntry = makeJournal(
      EJournalEntryStatus.Posted,
      EJournalSide.Debit
    );
    mockFxCostBasisLotService.acquire.mockReturnValue(null);

    await expect(
      service.acquire({ journalEntry, account, actor }, { correlationId })
    ).resolves.toBeNull();
  });

  it('skips official-rate lookup for an ambiguous account-line match', async () => {
    const journalEntry = makeJournal(
      EJournalEntryStatus.Posted,
      EJournalSide.Debit
    );
    journalEntry.lines.push({
      ...journalEntry.lines[0],
      id: generateUUID(),
      sequenceOrder: 2,
    });
    mockFxCostBasisLotService.acquire.mockReturnValue(null);

    await service.acquire({ journalEntry, account, actor }, { correlationId });

    expect(mockExchangeRateAppService.getOfficialRate).not.toHaveBeenCalled();
    expect(mockFxCostBasisLotService.acquire).toHaveBeenCalledWith({
      createdBy: actor,
      journalEntry,
      account,
      officialRate: null,
    });
  });

  it('prepares a disposition with read options and a missing-rate outbox', async () => {
    const journalEntry = makeJournal(
      EJournalEntryStatus.Posted,
      EJournalSide.Credit
    );
    const domainResult = makeDispositionResult(journalEntry, null);
    const repoOptions = { correlationId };
    mockExchangeRateAppService.getOfficialRate.mockResolvedValue(null);
    mockFxCostBasisLotService.dispose.mockResolvedValue(domainResult);

    const result = await service.dispose(
      { journalEntry, account, actor },
      repoOptions
    );

    expect(mockFxCostBasisLotService.dispose).toHaveBeenCalledWith(
      { journalEntry, account, officialRate: null, createdBy: actor },
      repoOptions
    );
    expect(result?.records.lots[0]).toMatchObject({
      lot: domainResult.lots[0][0],
      history: { actorId: actor, correlationId },
    });
    expect(result?.records.dispositionHistory).toMatchObject({
      actorId: actor,
      correlationId,
    });
    expect(result?.records.missingOfficialRateOutbox).toMatchObject({
      id: domainResult.disposition[0].id,
      correlationId,
      data: {
        effectKind: EMissingOfficialFxRateEffectKind.Disposition,
        journalEntryId: journalEntry.id,
        accountingEntityId,
        createdBy: userId,
        effectiveDate: date,
      },
    });
    expect(result?.events).toEqual([
      ...domainResult.lots[0][1],
      ...domainResult.disposition[1],
    ]);
  });

  it('returns null when the domain finds no posted disposition effect', async () => {
    const journalEntry = makeJournal(
      EJournalEntryStatus.Posted,
      EJournalSide.Credit
    );
    mockFxCostBasisLotService.dispose.mockResolvedValue(null);

    await expect(
      service.dispose({ journalEntry, account, actor }, { correlationId })
    ).resolves.toBeNull();
  });

  it('propagates official-rate and domain failures', async () => {
    const journalEntry = makeJournal(
      EJournalEntryStatus.Posted,
      EJournalSide.Debit
    );
    const rateFailure = new Error('rate failure');
    mockExchangeRateAppService.getOfficialRate.mockRejectedValueOnce(
      rateFailure
    );

    await expect(
      service.acquire({ journalEntry, account, actor }, { correlationId })
    ).rejects.toBe(rateFailure);

    const domainFailure = new Error('domain failure');
    mockExchangeRateAppService.getOfficialRate.mockResolvedValueOnce(
      officialRate
    );
    mockFxCostBasisLotService.acquire.mockImplementationOnce(() => {
      throw domainFailure;
    });

    await expect(
      service.acquire({ journalEntry, account, actor }, { correlationId })
    ).rejects.toBe(domainFailure);
  });
});
