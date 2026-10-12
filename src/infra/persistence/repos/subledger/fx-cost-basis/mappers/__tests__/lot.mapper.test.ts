import { TEntityId } from '@shared/types/uuid';

import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import { EExchangeRateType } from '@domain/money/types/exchange-rate.types';
import moneyValue from '@domain/money/values/money.vo';
import {
  EFxCostBasisLotStatus,
  IFxCostBasisLot,
} from '@domain/subledger/fx-cost-basis/types/lot.types';

import fxCostBasisLotMapper, {
  IFxCostBasisLotModel,
} from '@infra/persistence/repos/subledger/fx-cost-basis/mappers/lot.mapper';

describe('FX Cost-Basis Lot Mapper', () => {
  describe('toRepo', () => {
    it('should map a domain lot to a repo model', () => {
      const createdAt = new Date('2026-04-10T12:00:00.000Z');
      const updatedAt = new Date('2026-04-10T12:30:00.000Z');
      const acquisitionDate = new Date('2026-04-09T00:00:00.000Z');

      const domainLot: IFxCostBasisLot = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: 'lot-1' as TEntityId,
        ledgerAccountId: 'ledger-account-1' as TEntityId,
        accountingEntityId: 'accounting-entity-1' as TEntityId,
        status: EFxCostBasisLotStatus.Open,
        originalQuantity: moneyValue.make(100, SYSTEM_CURRENCIES.USD, false),
        remainingQuantity: moneyValue.make(60, SYSTEM_CURRENCIES.USD, false),
        costBasis: moneyValue.make(150000, SYSTEM_CURRENCIES.NGN, false),
        remainingCostBasis: moneyValue.make(
          90000,
          SYSTEM_CURRENCIES.NGN,
          false
        ),
        acquisitionRate: {
          currencyPair: 'USD/NGN',
          baseCurrencyCode: 'USD',
          targetCurrencyCode: 'NGN',
          rate: 1500,
          type: EExchangeRateType.Negotiated,
          asOf: acquisitionDate,
          source: 'bank',
          createdAt: acquisitionDate,
        },
        acquisitionDate,
        version: 2,
        createdAt,
        updatedAt,
      };

      const expectedRepoModel: IFxCostBasisLotModel = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: 'lot-1',
        ledgerAccountId: 'ledger-account-1',
        accountingEntityId: 'accounting-entity-1',
        status: EFxCostBasisLotStatus.Open,
        originalQuantityAmount: 10000,
        originalQuantityCurrency: 'USD',
        remainingQuantityAmount: 6000,
        costBasisAmount: 15000000,
        costBasisCurrency: 'NGN',
        remainingCostBasisAmount: 9000000,
        acquisitionRate: {
          currencyPair: 'USD/NGN',
          baseCurrencyCode: 'USD',
          targetCurrencyCode: 'NGN',
          rate: '1500',
          type: EExchangeRateType.Negotiated,
          asOf: acquisitionDate.toISOString(),
          source: 'bank',
          createdAt: acquisitionDate.toISOString(),
        },
        acquisitionDate: acquisitionDate.toISOString(),
        version: 2,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      };

      expect(fxCostBasisLotMapper.toRepo(domainLot)).toEqual(expectedRepoModel);
    });
  });
});
