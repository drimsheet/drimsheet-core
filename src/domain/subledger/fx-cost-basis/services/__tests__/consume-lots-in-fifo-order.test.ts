import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import journalLineEntity from '@domain/journal-entry/entities/journal-line.entity';
import { IJournalLine } from '@domain/journal-entry/types/journal-line.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import { EExchangeRateType } from '@domain/money/types/exchange-rate.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';
import moneyValue from '@domain/money/values/money.vo';
import fxCostBasisLotEntity from '@domain/subledger/fx-cost-basis/entities/lot.entity';
import fxCostBasisLotError from '@domain/subledger/fx-cost-basis/errors/lot.error';
import consumeLotsInFifoOrder from '@domain/subledger/fx-cost-basis/services/consume-lots-in-fifo-order';
import { EFxCostBasisLotStatus } from '@domain/subledger/fx-cost-basis/types/lot.types';

describe('consumeLotsInFifoOrder', () => {
  const date = new Date('2026-08-01T00:00:00.000Z');
  const accountId = generateUUID();
  const entityId = generateUUID();
  const dispositionRate = {
    currencyPair: 'USD/NGN',
    baseCurrencyCode: SYSTEM_CURRENCIES.USD.code,
    targetCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
    rate: 1500,
    type: EExchangeRateType.Negotiated,
    asOf: date,
    source: 'bank',
    createdAt: date,
  };

  function makeJournalLine(quantity: number): IJournalLine {
    const amount = moneyValue.make(quantity, SYSTEM_CURRENCIES.USD, false);

    return {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: generateUUID(),
      entryId: generateUUID(),
      accountId,
      counterpartyId: null,
      sequenceOrder: 1,
      amount,
      exchangeRate: dispositionRate,
      functionalAmount: moneyValue.convert(
        amount,
        dispositionRate,
        SYSTEM_CURRENCIES.NGN
      ),
      side: 'credit',
      description: null,
      meta: null,
      version: 1,
      createdAt: date,
      updatedAt: date,
    };
  }

  function makeLot(
    originalQuantity: number,
    remainingQuantity: number,
    costBasis: number,
    remainingCostBasis: number,
    acquisitionRate: number
  ) {
    return fxCostBasisLotEntity.make({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      ledgerAccountId: accountId,
      accountingEntityId: entityId,
      status: EFxCostBasisLotStatus.Open,
      originalQuantity: moneyValue.make(
        originalQuantity,
        SYSTEM_CURRENCIES.USD,
        false
      ),
      remainingQuantity: moneyValue.make(
        remainingQuantity,
        SYSTEM_CURRENCIES.USD,
        false
      ),
      costBasis: moneyValue.make(costBasis, SYSTEM_CURRENCIES.NGN, false),
      remainingCostBasis: moneyValue.make(
        remainingCostBasis,
        SYSTEM_CURRENCIES.NGN,
        false
      ),
      acquisitionRate: { ...dispositionRate, rate: acquisitionRate },
      acquisitionDate: date,
    })[0];
  }

  it('consumes the supplied lots in order and reconciles allocation totals', () => {
    const firstLot = makeLot(60, 60, 84_000, 84_000, 1400);
    const secondLot = makeLot(50, 50, 72_500, 72_500, 1450);
    const unusedLot = makeLot(20, 20, 30_000, 30_000, 1500);
    const journalLine = makeJournalLine(100);

    const result = consumeLotsInFifoOrder(
      [firstLot, secondLot, unusedLot],
      journalLine
    );

    expect(result.lots).toHaveLength(2);
    expect(result.lots[0][0].status).toBe(EFxCostBasisLotStatus.Closed);
    expect(result.lots[1][0].remainingQuantity).toEqual(
      moneyValue.make(10, SYSTEM_CURRENCIES.USD, false)
    );
    expect(result.costBasisConsumed).toEqual(
      moneyValue.make(142_000, SYSTEM_CURRENCIES.NGN, false)
    );
    expect(
      moneyValue.add(
        ...result.allocationSegments.map(({ proceeds }) => proceeds)
      )
    ).toEqual(journalLine.functionalAmount);
  });

  it('consumes the exact remaining basis when closing a partially used lot', () => {
    const lot = makeLot(100, 10, 140_000, 13_999, 1400);

    const result = consumeLotsInFifoOrder([lot], makeJournalLine(10));

    expect(result.costBasisConsumed).toEqual(lot.remainingCostBasis);
    expect(result.lots[0][0]).toMatchObject({
      status: EFxCostBasisLotStatus.Closed,
      remainingQuantity: moneyValue.makeZeroAmount(SYSTEM_CURRENCIES.USD),
      remainingCostBasis: moneyValue.makeZeroAmount(SYSTEM_CURRENCIES.NGN),
    });
  });

  it.each([
    {
      source: SYSTEM_CURRENCIES.USD,
      target: SYSTEM_CURRENCIES.JPY,
      acquisitionRate: 140,
      saleRate: 150,
      firstBasis: 140n,
      secondBasis: 280n,
      consumed: 210n,
      firstProceeds: 150n,
      finalProceeds: 75n,
      remainingBasis: 210n,
    },
    {
      source: SYSTEM_CURRENCIES.JPY,
      target: SYSTEM_CURRENCIES.USD,
      acquisitionRate: 0.005,
      saleRate: 0.006,
      firstBasis: 50n,
      secondBasis: 100n,
      consumed: 75n,
      firstProceeds: 60n,
      finalProceeds: 30n,
      remainingBasis: 75n,
    },
  ])(
    'reconciles $source.code/$target.code basis and proceeds across precision changes',
    (scenario) => {
      const rate = exchangeRateValue.make({
        baseCurrencyCode: scenario.source.code,
        targetCurrencyCode: scenario.target.code,
        rate: scenario.acquisitionRate,
        type: EExchangeRateType.Negotiated,
        asOf: date,
        source: 'bank',
      });
      const lots = [
        { quantity: 100n, basis: scenario.firstBasis },
        { quantity: 200n, basis: scenario.secondBasis },
      ].map(
        (lot) =>
          fxCostBasisLotEntity.make({
            createdBy: entityId,
            ledgerAccountId: accountId,
            accountingEntityId: entityId,
            status: EFxCostBasisLotStatus.Open,
            originalQuantity: moneyValue.make(
              lot.quantity,
              scenario.source,
              true
            ),
            remainingQuantity: moneyValue.make(
              lot.quantity,
              scenario.source,
              true
            ),
            costBasis: moneyValue.make(lot.basis, scenario.target, true),
            remainingCostBasis: moneyValue.make(
              lot.basis,
              scenario.target,
              true
            ),
            acquisitionRate: rate,
            acquisitionDate: date,
          })[0]
      );
      const [journalLine] = journalLineEntity.make(
        {
          id: entityId,
          memo: null,
          createdBy: entityId,
          createdAt: date,
        },
        {
          accountId,
          sequenceOrder: 1,
          amount: moneyValue.make(150n, scenario.source, true),
          functionalCurrency: scenario.target,
          exchangeRate: exchangeRateValue.make({
            ...rate,
            rate: scenario.saleRate,
          }),
          side: 'credit',
          description: null,
        }
      );

      const result = consumeLotsInFifoOrder(lots, journalLine);

      expect(result.costBasisConsumed).toEqual(
        moneyValue.make(scenario.consumed, scenario.target, true)
      );
      expect(
        result.allocationSegments.map(
          (allocation) => allocation.proceeds.amount
        )
      ).toEqual([scenario.firstProceeds, scenario.finalProceeds]);
      expect(
        moneyValue.add(
          ...result.allocationSegments.map((allocation) => allocation.proceeds)
        )
      ).toEqual(journalLine.functionalAmount);
      expect(
        moneyValue.add(
          ...result.allocationSegments.map(
            (allocation) => allocation.realizedGainLoss
          )
        ).amount
      ).toBe(15n);
      expect(result.lots[0][0].remainingCostBasis.amount).toBe(0n);
      expect(result.lots[0][0].status).toBe(EFxCostBasisLotStatus.Closed);
      expect(result.lots[1][0].remainingQuantity.amount).toBe(150n);
      expect(result.lots[1][0].remainingCostBasis.amount).toBe(
        scenario.remainingBasis
      );
    }
  );

  it('rejects the operation when the supplied lots cannot cover the quantity', () => {
    const lot = makeLot(60, 60, 84_000, 84_000, 1400);

    expect(() => consumeLotsInFifoOrder([lot], makeJournalLine(100))).toThrow(
      fxCostBasisLotError.InsufficientQuantity
    );
  });
});
