import { TCreationOmits } from '@shared/types/creation-omits.types';

import { IJournalLine } from '@domain/journal-entry/types/journal-line.types';
import { IMoney } from '@domain/money/types/money.types';
import moneyValue from '@domain/money/values/money.vo';
import fxCostBasisLotEntity from '@domain/subledger/fx-cost-basis/entities/lot.entity';
import fxCostBasisLotError from '@domain/subledger/fx-cost-basis/errors/lot.error';
import { IFxCostBasisLotDispositionAllocation } from '@domain/subledger/fx-cost-basis/types/disposition.types';
import { IFxCostBasisDispositionResult } from '@domain/subledger/fx-cost-basis/types/lot.service.types';
import { IFxCostBasisLot } from '@domain/subledger/fx-cost-basis/types/lot.types';

type TDispositionAllocationSegment = Omit<
  TCreationOmits<IFxCostBasisLotDispositionAllocation>,
  'dispositionId' | 'createdBy'
>;

interface IFifoConsumptionResult {
  lots: IFxCostBasisDispositionResult['lots'];
  allocationSegments: TDispositionAllocationSegment[];
  costBasisConsumed: IMoney;
}

function getCostBasisConsumed(lot: IFxCostBasisLot, quantity: IMoney) {
  const consumesEntireLot = moneyValue.equals(quantity, lot.remainingQuantity);

  // Closing a lot consumes its exact stored residual so rounding cannot leave
  // cost-basis dust on a zero-quantity lot.
  if (consumesEntireLot) {
    return lot.remainingCostBasis;
  }

  const convertedBasis = moneyValue.convert(
    quantity,
    lot.acquisitionRate,
    lot.remainingCostBasis.currency
  );

  return moneyValue.min(convertedBasis, lot.remainingCostBasis);
}

function getAllocationProceeds(
  journalLine: IJournalLine,
  quantity: IMoney,
  allocatedProceeds: IMoney,
  isFinalAllocation: boolean
) {
  // The final allocation absorbs any conversion residual so allocation
  // proceeds reconcile exactly to the completed journal line.
  if (isFinalAllocation) {
    return moneyValue.subtract(journalLine.functionalAmount, allocatedProceeds);
  }

  return moneyValue.convert(
    quantity,
    journalLine.exchangeRate!,
    journalLine.functionalAmount.currency
  );
}

/**
 * Consumes lots in the repository's FIFO order and prepares the immutable
 * allocation facts for the resulting disposition.
 *
 * Full lots use their exact remaining basis, and the final allocation absorbs
 * the journal-proceeds residual. The operation fails without returning a
 * partial result when the supplied open lots cannot cover the journal quantity.
 */
export default function consumeLotsInFifoOrder(
  lots: IFxCostBasisLot[],
  journalLine: IJournalLine
): IFifoConsumptionResult {
  let remainingQuantity = journalLine.amount;
  let allocatedProceeds = moneyValue.makeZeroAmount(
    journalLine.functionalAmount.currency
  );
  let costBasisConsumed = moneyValue.makeZeroAmount(
    journalLine.functionalAmount.currency
  );
  const consumedLots: IFxCostBasisDispositionResult['lots'] = [];
  const allocationSegments: TDispositionAllocationSegment[] = [];

  for (const lot of lots) {
    if (moneyValue.isZeroAmount(remainingQuantity)) {
      break;
    }

    const quantity = moneyValue.min(remainingQuantity, lot.remainingQuantity);
    const basis = getCostBasisConsumed(lot, quantity);
    const isFinalAllocation = moneyValue.equals(quantity, remainingQuantity);
    const proceeds = getAllocationProceeds(
      journalLine,
      quantity,
      allocatedProceeds,
      isFinalAllocation
    );

    consumedLots.push(fxCostBasisLotEntity.consume(lot, quantity, basis));
    allocationSegments.push({
      lotId: lot.id,
      quantity,
      costBasisConsumed: basis,
      proceeds,
      realizedGainLoss: moneyValue.subtract(proceeds, basis),
    });

    remainingQuantity = moneyValue.subtract(remainingQuantity, quantity);
    allocatedProceeds = moneyValue.add(allocatedProceeds, proceeds);
    costBasisConsumed = moneyValue.add(costBasisConsumed, basis);
  }

  if (!moneyValue.isZeroAmount(remainingQuantity)) {
    throw new fxCostBasisLotError.InsufficientQuantity({
      requested: journalLine.amount,
      unavailable: remainingQuantity,
    });
  }

  return { lots: consumedLots, allocationSegments, costBasisConsumed };
}
