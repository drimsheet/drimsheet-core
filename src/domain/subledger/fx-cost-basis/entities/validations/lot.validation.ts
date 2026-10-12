import { IMoney } from '@domain/money/types/money.types';
import moneyValue from '@domain/money/values/money.vo';
import fxCostBasisLotError from '@domain/subledger/fx-cost-basis/errors/lot.error';
import {
  EFxCostBasisLotStatus,
  IFxCostBasisLot,
  UFxCostBasisLotStatus,
} from '@domain/subledger/fx-cost-basis/types/lot.types';

function isValidStatus(status: unknown): status is UFxCostBasisLotStatus {
  return Object.values(EFxCostBasisLotStatus).includes(
    status as UFxCostBasisLotStatus
  );
}

function validateStatus(status: unknown) {
  if (!isValidStatus(status)) {
    throw new fxCostBasisLotError.InvalidStatus({ status });
  }
}

function isValidMoney(value: unknown): value is IMoney {
  try {
    moneyValue.validate(value as IMoney);
    return true;
  } catch {
    return false;
  }
}

function isPositiveMoney(value: IMoney) {
  return value.amount > 0n;
}

function isNonNegativeMoney(value: IMoney) {
  return value.amount >= 0n;
}

function validateOriginalQuantity(
  originalQuantity: unknown
): asserts originalQuantity is IMoney {
  if (!isValidMoney(originalQuantity) || !isPositiveMoney(originalQuantity)) {
    throw new fxCostBasisLotError.InvalidOriginalQuantity({ originalQuantity });
  }
}

function validateRemainingQuantity(
  remainingQuantity: unknown
): asserts remainingQuantity is IMoney {
  if (
    !isValidMoney(remainingQuantity) ||
    !isNonNegativeMoney(remainingQuantity)
  ) {
    throw new fxCostBasisLotError.InvalidRemainingQuantity({
      remainingQuantity,
    });
  }
}

function validateOriginalCostBasis(
  costBasis: unknown
): asserts costBasis is IMoney {
  if (!isValidMoney(costBasis) || !isPositiveMoney(costBasis)) {
    throw new fxCostBasisLotError.InvalidCostBasis({ costBasis });
  }
}

function validateRemainingCostBasis(
  remainingCostBasis: unknown
): asserts remainingCostBasis is IMoney {
  if (
    !isValidMoney(remainingCostBasis) ||
    !isNonNegativeMoney(remainingCostBasis)
  ) {
    throw new fxCostBasisLotError.InvalidRemainingCostBasis({
      remainingCostBasis,
    });
  }
}

function validateQuantity(
  originalQuantity: unknown,
  remainingQuantity: unknown
) {
  validateOriginalQuantity(originalQuantity);
  validateRemainingQuantity(remainingQuantity);

  if (!moneyValue.isSameCurrency(originalQuantity, remainingQuantity)) {
    throw new fxCostBasisLotError.MismatchedQuantityCurrency({
      originalQuantity,
      remainingQuantity,
    });
  }

  if (moneyValue.isGreaterThan(remainingQuantity, originalQuantity)) {
    throw new fxCostBasisLotError.ExcessRemainingQuantity({
      originalQuantity,
      remainingQuantity,
    });
  }
}

function validateCostBasis(costBasis: unknown, remainingCostBasis: unknown) {
  validateOriginalCostBasis(costBasis);
  validateRemainingCostBasis(remainingCostBasis);

  if (!moneyValue.isSameCurrency(costBasis, remainingCostBasis)) {
    throw new fxCostBasisLotError.MismatchedCostBasisCurrency({
      costBasis,
      remainingCostBasis,
    });
  }

  if (moneyValue.isGreaterThan(remainingCostBasis, costBasis)) {
    throw new fxCostBasisLotError.ExcessRemainingCostBasis({
      costBasis,
      remainingCostBasis,
    });
  }
}

function validateConsumption(
  lot: IFxCostBasisLot,
  quantity: IFxCostBasisLot['remainingQuantity'],
  costBasis: IFxCostBasisLot['remainingCostBasis']
) {
  if (
    lot.status !== EFxCostBasisLotStatus.Open ||
    moneyValue.isZeroAmount(lot.remainingQuantity)
  ) {
    throw new fxCostBasisLotError.ClosedLot({ lotId: lot.id });
  }

  const zeroQuantity = moneyValue.makeZeroAmount(
    lot.remainingQuantity.currency
  );
  moneyValue.validate(quantity);
  if (
    !moneyValue.isSameCurrency(quantity, lot.remainingQuantity) ||
    !moneyValue.isGreaterThan(quantity, zeroQuantity) ||
    moneyValue.isGreaterThan(quantity, lot.remainingQuantity)
  ) {
    throw new fxCostBasisLotError.InvalidConsumptionQuantity({ quantity });
  }

  const zeroCostBasis = moneyValue.makeZeroAmount(
    lot.remainingCostBasis.currency
  );
  moneyValue.validate(costBasis);
  if (
    !moneyValue.isSameCurrency(costBasis, lot.remainingCostBasis) ||
    !moneyValue.isGreaterThan(costBasis, zeroCostBasis) ||
    moneyValue.isGreaterThan(costBasis, lot.remainingCostBasis)
  ) {
    throw new fxCostBasisLotError.InvalidConsumptionCostBasis({ costBasis });
  }
}

function validateConsumptionRemainder(
  remainingQuantity: IFxCostBasisLot['remainingQuantity'],
  remainingCostBasis: IFxCostBasisLot['remainingCostBasis'],
  costBasis: IFxCostBasisLot['remainingCostBasis']
) {
  if (
    moneyValue.isZeroAmount(remainingQuantity) &&
    !moneyValue.isZeroAmount(remainingCostBasis)
  ) {
    throw new fxCostBasisLotError.InvalidConsumptionCostBasis({
      costBasis,
      remainingCostBasis,
    });
  }
}

const fxCostBasisLotValidation = Object.freeze({
  isValidStatus,
  validateStatus,
  isValidMoney,
  validateQuantity,
  validateCostBasis,
  validateConsumption,
  validateConsumptionRemainder,
});

export default fxCostBasisLotValidation;
