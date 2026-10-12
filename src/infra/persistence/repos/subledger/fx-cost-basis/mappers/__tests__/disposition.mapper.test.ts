import { TEntityId } from '@shared/types/uuid';

import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import { EExchangeRateType } from '@domain/money/types/exchange-rate.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';
import moneyValue from '@domain/money/values/money.vo';
import { IFxCostBasisLotDisposition } from '@domain/subledger/fx-cost-basis/types/disposition.types';

import exchangeRateMapper from '@infra/persistence/repos/money/mappers/exchange-rate.mapper';
import fxCostBasisLotDispositionMapper, {
  IFxCostBasisLotDispositionModel,
} from '@infra/persistence/repos/subledger/fx-cost-basis/mappers/disposition.mapper';

describe('FX Cost-Basis Lot Disposition Mapper', () => {
  const createdAt = new Date('2026-08-31T12:00:00.000Z');
  const dispositionDate = new Date('2026-08-30T00:00:00.000Z');
  const dispositionRate = exchangeRateValue.make({
    baseCurrencyCode: SYSTEM_CURRENCIES.USD.code,
    targetCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
    rate: 1600,
    type: EExchangeRateType.Negotiated,
    asOf: dispositionDate,
    source: 'bank',
  });
  const officialRate = exchangeRateValue.make({
    baseCurrencyCode: SYSTEM_CURRENCIES.USD.code,
    targetCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
    rate: 1550,
    type: EExchangeRateType.Official,
    asOf: dispositionDate,
    source: 'cbn',
  });

  function makeDisposition(
    rate: IFxCostBasisLotDisposition['officialRate']
  ): IFxCostBasisLotDisposition {
    return {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'disposition-1' as TEntityId,
      ledgerAccountId: 'ledger-account-1' as TEntityId,
      accountingEntityId: 'accounting-entity-1' as TEntityId,
      journalEntryId: 'journal-entry-1' as TEntityId,
      quantity: moneyValue.make(100, SYSTEM_CURRENCIES.USD, false),
      costBasisConsumed: moneyValue.make(150000, SYSTEM_CURRENCIES.NGN, false),
      proceeds: moneyValue.make(160000, SYSTEM_CURRENCIES.NGN, false),
      realizedGainLoss: moneyValue.make(10000, SYSTEM_CURRENCIES.NGN, false),
      dispositionRate,
      officialRate: rate,
      dispositionDate,
      createdAt,
    };
  }

  function expectedModel(
    rate: IFxCostBasisLotDispositionModel['officialRate']
  ): IFxCostBasisLotDispositionModel {
    return {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'disposition-1',
      ledgerAccountId: 'ledger-account-1',
      accountingEntityId: 'accounting-entity-1',
      journalEntryId: 'journal-entry-1',
      quantityAmount: 10000,
      quantityCurrency: SYSTEM_CURRENCIES.USD.code,
      costBasisConsumedAmount: 15000000,
      costBasisConsumedCurrency: SYSTEM_CURRENCIES.NGN.code,
      proceedsAmount: 16000000,
      proceedsCurrency: SYSTEM_CURRENCIES.NGN.code,
      realizedGainLossAmount: 1000000,
      realizedGainLossCurrency: SYSTEM_CURRENCIES.NGN.code,
      dispositionRate,
      officialRate: rate,
      dispositionDate: '2026-08-30',
      createdAt: createdAt.toISOString(),
    };
  }

  it('maps every disposition field to the repository model', () => {
    expect(
      fxCostBasisLotDispositionMapper.toRepo(makeDisposition(officialRate))
    ).toEqual(expectedModel(exchangeRateMapper.toEmbedded(officialRate)));
  });

  it('maps a missing official rate to null', () => {
    expect(
      fxCostBasisLotDispositionMapper.toRepo(makeDisposition(null))
    ).toEqual(expectedModel(null));
  });
});
