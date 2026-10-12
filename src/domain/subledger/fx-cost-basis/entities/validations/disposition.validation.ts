import { IExchangeRate } from '@domain/money/types/exchange-rate.types';
import { IMoney } from '@domain/money/types/money.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';
import moneyValue from '@domain/money/values/money.vo';
import FxCostBasisLotDispositionError from '@domain/subledger/fx-cost-basis/errors/disposition.error';
import { IFxCostBasisLotDisposition } from '@domain/subledger/fx-cost-basis/types/disposition.types';

function isValidMoney(value: unknown): value is IMoney {
  try {
    moneyValue.validate(value as IMoney);
    return true;
  } catch {
    return false;
  }
}

function validateQuantity(quantity: unknown) {
  if (!isValidMoney(quantity) || quantity.amount <= 0n) {
    throw new FxCostBasisLotDispositionError.InvalidQuantity({ quantity });
  }
}

function validateCostBasisConsumed(costBasisConsumed: unknown) {
  if (!isValidMoney(costBasisConsumed) || costBasisConsumed.amount <= 0n) {
    throw new FxCostBasisLotDispositionError.InvalidCostBasisConsumed({
      costBasisConsumed,
    });
  }
}

function validateProceeds(proceeds: unknown) {
  if (!isValidMoney(proceeds) || proceeds.amount <= 0n) {
    throw new FxCostBasisLotDispositionError.InvalidProceeds({ proceeds });
  }
}

function validateRealizedGainLoss(realizedGainLoss: unknown) {
  if (!isValidMoney(realizedGainLoss)) {
    throw new FxCostBasisLotDispositionError.InvalidRealizedGainLoss({
      realizedGainLoss,
    });
  }
}

type TFunctionalAmounts = Pick<
  IFxCostBasisLotDisposition,
  'costBasisConsumed' | 'proceeds' | 'realizedGainLoss'
>;

function validateFunctionalCurrency(payload: TFunctionalAmounts) {
  const hasMatchingFunctionalCurrency =
    moneyValue.isSameCurrency(payload.costBasisConsumed, payload.proceeds) &&
    moneyValue.isSameCurrency(payload.proceeds, payload.realizedGainLoss);

  if (!hasMatchingFunctionalCurrency) {
    throw new FxCostBasisLotDispositionError.MismatchedFunctionalCurrency({
      costBasisConsumed: payload.costBasisConsumed,
      proceeds: payload.proceeds,
      realizedGainLoss: payload.realizedGainLoss,
    });
  }
}

function validateRealizedGainLossFormula(payload: TFunctionalAmounts) {
  const expectedRealizedGainLoss = moneyValue.subtract(
    payload.proceeds,
    payload.costBasisConsumed
  );

  if (!moneyValue.equals(expectedRealizedGainLoss, payload.realizedGainLoss)) {
    throw new FxCostBasisLotDispositionError.InvalidRealizedGainLossFormula({
      expectedRealizedGainLoss,
      realizedGainLoss: payload.realizedGainLoss,
    });
  }
}

function validateOfficialRate(officialRate: IExchangeRate | null) {
  if (officialRate) {
    exchangeRateValue.validate(officialRate);
  }
}

const fxCostBasisLotDispositionValidation = Object.freeze({
  isValidMoney,
  validateQuantity,
  validateCostBasisConsumed,
  validateProceeds,
  validateRealizedGainLoss,
  validateFunctionalCurrency,
  validateRealizedGainLossFormula,
  validateOfficialRate,
});

export default fxCostBasisLotDispositionValidation;
