import { IExchangeRate } from '@domain/money/types/exchange-rate.types';
import { IMoney } from '@domain/money/types/money.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';
import moneyValue from '@domain/money/values/money.vo';
import fxCostBasisLotAcquisitionError from '@domain/subledger/fx-cost-basis/errors/acquisition.error';

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
    throw new fxCostBasisLotAcquisitionError.InvalidQuantity({ quantity });
  }
}

function validateCostBasis(costBasis: unknown) {
  if (!isValidMoney(costBasis) || costBasis.amount <= 0n) {
    throw new fxCostBasisLotAcquisitionError.InvalidCostBasis({ costBasis });
  }
}

function validateOfficialRate(officialRate: IExchangeRate | null) {
  if (officialRate) {
    exchangeRateValue.validate(officialRate);
  }
}

const fxCostBasisLotAcquisitionValidation = Object.freeze({
  isValidMoney,
  validateQuantity,
  validateCostBasis,
  validateOfficialRate,
});

export default fxCostBasisLotAcquisitionValidation;
