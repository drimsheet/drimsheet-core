import generateUUID from '@shared/utils/uuid-generator';

import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import {
  EExchangeRateType,
  IExchangeRate,
} from '@domain/money/types/exchange-rate.types';
import moneyValue from '@domain/money/values/money.vo';
import fxCostBasisLotAcquisitionEntity from '@domain/subledger/fx-cost-basis/entities/acquisition.entity';
import fxCostBasisLotDispositionAllocationEntity from '@domain/subledger/fx-cost-basis/entities/disposition-allocation.entity';
import fxCostBasisLotDispositionEntity from '@domain/subledger/fx-cost-basis/entities/disposition.entity';
import fxCostBasisLotEntity from '@domain/subledger/fx-cost-basis/entities/lot.entity';
import {
  IFxCostBasisAcquisitionResult,
  IFxCostBasisDispositionResult,
} from '@domain/subledger/fx-cost-basis/types/lot.service.types';
import { EFxCostBasisLotStatus } from '@domain/subledger/fx-cost-basis/types/lot.types';

const date = new Date('2000-01-01T00:00:00Z');
const transactionRate: IExchangeRate = {
  currencyPair: 'USD/NGN',
  baseCurrencyCode: 'USD',
  targetCurrencyCode: 'NGN',
  rate: 1500,
  asOf: date,
  source: 'bank',
  type: EExchangeRateType.Negotiated,
  createdAt: date,
};
const officialRate: IExchangeRate = {
  ...transactionRate,
  source: 'central-bank',
  type: EExchangeRateType.Official,
};

export function makeFxAcquisitionResult(
  rate: IExchangeRate | null = officialRate
): IFxCostBasisAcquisitionResult {
  const createdBy = generateUUID();
  const ledgerAccountId = generateUUID();
  const accountingEntityId = generateUUID();
  const quantity = moneyValue.make(10, SYSTEM_CURRENCIES.USD, false);
  const costBasis = moneyValue.make(15000, SYSTEM_CURRENCIES.NGN, false);
  const lot = fxCostBasisLotEntity.make({
    createdBy,
    ledgerAccountId,
    accountingEntityId,
    status: EFxCostBasisLotStatus.Open,
    originalQuantity: quantity,
    remainingQuantity: quantity,
    costBasis,
    remainingCostBasis: costBasis,
    acquisitionRate: transactionRate,
    acquisitionDate: date,
  });
  const [acquiredLot] = lot;
  const acquisition = fxCostBasisLotAcquisitionEntity.make({
    createdBy,
    ledgerAccountId,
    accountingEntityId,
    lotId: acquiredLot.id,
    journalEntryId: generateUUID(),
    quantity,
    costBasis,
    acquisitionRate: transactionRate,
    officialRate: rate,
    acquisitionDate: date,
  });

  return { lot, acquisition };
}

export function makeFxDispositionResult(
  rate: IExchangeRate | null = officialRate
): IFxCostBasisDispositionResult {
  const acquisition = makeFxAcquisitionResult();
  const [lot] = acquisition.lot;
  const quantity = lot.remainingQuantity;
  const costBasis = lot.remainingCostBasis;
  const proceeds = moneyValue.make(16000, SYSTEM_CURRENCIES.NGN, false);
  const realizedGainLoss = moneyValue.subtract(proceeds, costBasis);
  const consumedLot = fxCostBasisLotEntity.consume(lot, quantity, costBasis);
  const disposition = fxCostBasisLotDispositionEntity.make({
    createdBy: lot.createdBy,
    ledgerAccountId: lot.ledgerAccountId,
    accountingEntityId: lot.accountingEntityId,
    journalEntryId: generateUUID(),
    quantity,
    costBasisConsumed: costBasis,
    proceeds,
    realizedGainLoss,
    dispositionRate: transactionRate,
    officialRate: rate,
    dispositionDate: date,
  });
  const allocation = fxCostBasisLotDispositionAllocationEntity.make({
    createdBy: lot.createdBy,
    dispositionId: disposition[0].id,
    lotId: lot.id,
    quantity,
    costBasisConsumed: costBasis,
    proceeds,
    realizedGainLoss,
  });

  return { lots: [consumedLot], disposition, allocations: [allocation] };
}
