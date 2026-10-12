import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';
import fxCostBasisLotDispositionAllocationEntity from '@domain/subledger/fx-cost-basis/entities/disposition-allocation.entity';
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
  it.each([
    [0n, 1n],
    [1n, 0n],
    [0n, 0n],
  ])(
    'round-trips allocation basis %s and proceeds %s without losing zero amounts',
    (basis, proceeds) => {
      const allocation = fxCostBasisLotDispositionAllocationEntity.make({
        createdBy: generateUUID(),
        dispositionId: generateUUID(),
        lotId: generateUUID(),
        quantity: moneyValue.make(1n, SYSTEM_CURRENCIES.USD, true),
        costBasisConsumed: moneyValue.make(basis, SYSTEM_CURRENCIES.JPY, true),
        proceeds: moneyValue.make(proceeds, SYSTEM_CURRENCIES.JPY, true),
        realizedGainLoss: moneyValue.make(
          proceeds - basis,
          SYSTEM_CURRENCIES.JPY,
          true
        ),
      });

      const row = fxCostBasisLotDispositionAllocationMapper.toRepo(allocation);
      expect(row.costBasisConsumedAmount).toBe(Number(basis));
      expect(row.proceedsAmount).toBe(Number(proceeds));
      expect(fxCostBasisLotDispositionAllocationMapper.toDomain(row)).toEqual(
        allocation
      );
    }
  );
});
