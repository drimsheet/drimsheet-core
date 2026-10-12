import { TEntityId } from '@shared/types/uuid';

import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';
import { IFxCostBasisLotDispositionAllocation } from '@domain/subledger/fx-cost-basis/types/disposition.types';

import fxCostBasisLotDispositionAllocationMapper from '@infra/persistence/repos/subledger/fx-cost-basis/mappers/disposition-allocation.mapper';

describe('FX Cost-Basis Lot Disposition Allocation Mapper', () => {
  it('maps every allocation field to the repository model', () => {
    const createdAt = new Date('2026-08-31T12:00:00.000Z');
    const allocation: IFxCostBasisLotDispositionAllocation = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'allocation-1' as TEntityId,
      dispositionId: 'disposition-1' as TEntityId,
      lotId: 'lot-1' as TEntityId,
      quantity: moneyValue.make(40, SYSTEM_CURRENCIES.USD, false),
      costBasisConsumed: moneyValue.make(60000, SYSTEM_CURRENCIES.NGN, false),
      proceeds: moneyValue.make(64000, SYSTEM_CURRENCIES.NGN, false),
      realizedGainLoss: moneyValue.make(4000, SYSTEM_CURRENCIES.NGN, false),
      createdAt,
    };

    expect(
      fxCostBasisLotDispositionAllocationMapper.toRepo(allocation)
    ).toEqual({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'allocation-1',
      dispositionId: 'disposition-1',
      lotId: 'lot-1',
      quantityAmount: 4000,
      quantityCurrency: SYSTEM_CURRENCIES.USD.code,
      costBasisConsumedAmount: 6000000,
      costBasisConsumedCurrency: SYSTEM_CURRENCIES.NGN.code,
      proceedsAmount: 6400000,
      proceedsCurrency: SYSTEM_CURRENCIES.NGN.code,
      realizedGainLossAmount: 400000,
      realizedGainLossCurrency: SYSTEM_CURRENCIES.NGN.code,
      createdAt: createdAt.toISOString(),
    });
  });
});
