import { IMoney } from '@domain/money/types/money.types';
import moneyValue from '@domain/money/values/money.vo';
import fxCostBasisLotDispositionAllocationError from '@domain/subledger/fx-cost-basis/errors/disposition-allocation.error';
import { IFxCostBasisLotDispositionAllocation } from '@domain/subledger/fx-cost-basis/types/disposition.types';

function isValidMoney(value: unknown): value is IMoney {
  try {
    moneyValue.validate(value as IMoney);
    return true;
  } catch {
    return false;
  }
}

function validateQuantity(quantity: unknown) {
  const isValidQuantity =
    isValidMoney(quantity) &&
    moneyValue.isGreaterThan(
      quantity,
      moneyValue.makeZeroAmount(quantity.currency)
    );

  if (!isValidQuantity) {
    throw new fxCostBasisLotDispositionAllocationError.InvalidQuantity({
      quantity,
    });
  }
}

function validateCostBasisConsumed(costBasisConsumed: unknown) {
  const isValidCostBasis =
    isValidMoney(costBasisConsumed) &&
    moneyValue.isGreaterThan(
      costBasisConsumed,
      moneyValue.makeZeroAmount(costBasisConsumed.currency)
    );

  if (!isValidCostBasis) {
    throw new fxCostBasisLotDispositionAllocationError.InvalidCostBasisConsumed(
      {
        costBasisConsumed,
      }
    );
  }
}

function validateProceeds(proceeds: unknown) {
  const isValidProceeds =
    isValidMoney(proceeds) &&
    moneyValue.isGreaterThan(
      proceeds,
      moneyValue.makeZeroAmount(proceeds.currency)
    );

  if (!isValidProceeds) {
    throw new fxCostBasisLotDispositionAllocationError.InvalidProceeds({
      proceeds,
    });
  }
}

type TFunctionalAmounts = Pick<
  IFxCostBasisLotDispositionAllocation,
  'costBasisConsumed' | 'proceeds' | 'realizedGainLoss'
>;

function validateFunctionalCurrency(payload: TFunctionalAmounts) {
  moneyValue.validate(payload.realizedGainLoss);

  const hasMatchingFunctionalCurrencies =
    moneyValue.isSameCurrency(payload.costBasisConsumed, payload.proceeds) &&
    moneyValue.isSameCurrency(payload.proceeds, payload.realizedGainLoss);

  if (!hasMatchingFunctionalCurrencies) {
    throw new fxCostBasisLotDispositionAllocationError.MismatchedFunctionalCurrency(
      { payload }
    );
  }
}

function validateRealizedGainLossFormula(payload: TFunctionalAmounts) {
  const expectedRealizedGainLoss = moneyValue.subtract(
    payload.proceeds,
    payload.costBasisConsumed
  );
  const hasValidRealizedGainLoss = moneyValue.equals(
    expectedRealizedGainLoss,
    payload.realizedGainLoss
  );

  if (!hasValidRealizedGainLoss) {
    throw new fxCostBasisLotDispositionAllocationError.InvalidRealizedGainLossFormula(
      {
        expectedRealizedGainLoss,
        realizedGainLoss: payload.realizedGainLoss,
      }
    );
  }
}

const fxCostBasisLotDispositionAllocationValidation = Object.freeze({
  isValidMoney,
  validateQuantity,
  validateCostBasisConsumed,
  validateProceeds,
  validateFunctionalCurrency,
  validateRealizedGainLossFormula,
});

export default fxCostBasisLotDispositionAllocationValidation;
