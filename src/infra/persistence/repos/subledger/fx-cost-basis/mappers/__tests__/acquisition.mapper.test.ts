import { TEntityId } from '@shared/types/uuid';

import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import { EExchangeRateType } from '@domain/money/types/exchange-rate.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';
import moneyValue from '@domain/money/values/money.vo';
import { IFxCostBasisLotAcquisition } from '@domain/subledger/fx-cost-basis/types/acquisition.types';

import exchangeRateMapper from '@infra/persistence/repos/money/mappers/exchange-rate.mapper';
import fxCostBasisLotAcquisitionMapper, {
  IFxCostBasisLotAcquisitionModel,
} from '@infra/persistence/repos/subledger/fx-cost-basis/mappers/acquisition.mapper';

describe('FX Cost-Basis Lot Acquisition Mapper', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('toRepo', () => {
    it('should map a domain acquisition to a repo model', () => {
      const createdAt = new Date('2026-04-10T12:00:00.000Z');
      const acquisitionDate = new Date('2026-04-09T00:00:00.000Z');

      jest.setSystemTime(createdAt);

      const acquisitionRate = exchangeRateValue.make({
        baseCurrencyCode: SYSTEM_CURRENCIES.USD.code,
        targetCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
        rate: 1500,
        type: EExchangeRateType.Negotiated,
        asOf: acquisitionDate,
        source: 'bank',
      });

      const officialRate = exchangeRateValue.make({
        baseCurrencyCode: SYSTEM_CURRENCIES.USD.code,
        targetCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
        rate: 1450,
        type: EExchangeRateType.Official,
        asOf: acquisitionDate,
        source: 'cbn',
      });

      const domainAcquisition: IFxCostBasisLotAcquisition = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: 'acquisition-1' as TEntityId,
        ledgerAccountId: 'ledger-account-1' as TEntityId,
        accountingEntityId: 'accounting-entity-1' as TEntityId,
        lotId: 'lot-1' as TEntityId,
        journalEntryId: 'journal-entry-1' as TEntityId,
        quantity: moneyValue.make(100, SYSTEM_CURRENCIES.USD, false),
        costBasis: moneyValue.make(150000, SYSTEM_CURRENCIES.NGN, false),
        acquisitionRate,
        acquisitionDate,
        officialRate,
        createdAt,
      };

      const expectedRepoModel: IFxCostBasisLotAcquisitionModel = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: 'acquisition-1',
        ledgerAccountId: 'ledger-account-1',
        accountingEntityId: 'accounting-entity-1',
        lotId: 'lot-1',
        journalEntryId: 'journal-entry-1',
        quantityAmount: 10000,
        quantityCurrency: SYSTEM_CURRENCIES.USD.code,
        costBasisAmount: 15000000,
        costBasisCurrency: SYSTEM_CURRENCIES.NGN.code,
        acquisitionRate,
        acquisitionDate: '2026-04-09',
        officialRate: exchangeRateMapper.toEmbedded(officialRate),
        createdAt: createdAt.toISOString(),
      };

      expect(fxCostBasisLotAcquisitionMapper.toRepo(domainAcquisition)).toEqual(
        expectedRepoModel
      );
    });

    it('should map with officialRate as null', () => {
      const createdAt = new Date('2026-04-10T12:00:00.000Z');
      const acquisitionDate = new Date('2026-04-09T00:00:00.000Z');

      jest.setSystemTime(createdAt);

      const acquisitionRate = exchangeRateValue.make({
        baseCurrencyCode: SYSTEM_CURRENCIES.USD.code,
        targetCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
        rate: 1500,
        type: EExchangeRateType.Negotiated,
        asOf: acquisitionDate,
        source: 'bank',
      });

      const domainAcquisition: IFxCostBasisLotAcquisition = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: 'acquisition-1' as TEntityId,
        ledgerAccountId: 'ledger-account-1' as TEntityId,
        accountingEntityId: 'accounting-entity-1' as TEntityId,
        lotId: 'lot-1' as TEntityId,
        journalEntryId: 'journal-entry-1' as TEntityId,
        quantity: moneyValue.make(100, SYSTEM_CURRENCIES.USD, false),
        costBasis: moneyValue.make(150000, SYSTEM_CURRENCIES.NGN, false),
        acquisitionRate,
        acquisitionDate,
        officialRate: null,
        createdAt,
      };

      const expectedRepoModel: IFxCostBasisLotAcquisitionModel = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: 'acquisition-1',
        ledgerAccountId: 'ledger-account-1',
        accountingEntityId: 'accounting-entity-1',
        lotId: 'lot-1',
        journalEntryId: 'journal-entry-1',
        quantityAmount: 10000,
        quantityCurrency: SYSTEM_CURRENCIES.USD.code,
        costBasisAmount: 15000000,
        costBasisCurrency: SYSTEM_CURRENCIES.NGN.code,
        acquisitionRate,
        acquisitionDate: '2026-04-09',
        officialRate: null,
        createdAt: createdAt.toISOString(),
      };

      expect(fxCostBasisLotAcquisitionMapper.toRepo(domainAcquisition)).toEqual(
        expectedRepoModel
      );
    });
  });
});
