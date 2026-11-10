import { TCreationOmits } from '@shared/types/creation-omits.types';
import dateUtils from '@shared/utils/date';
import stringUtils from '@shared/utils/string';

import currencyEntity from '@domain/money/entities/currency.entity';
import exchangeRateError from '@domain/money/errors/exchange-rate.error';
import { IExchangeRate } from '@domain/money/types/exchange-rate.types';
import getExchangeRateCurrencyPairHelper from '@domain/money/values/helpers/get-currency-pair.helper';
import exchangeRateValidation from '@domain/money/values/validations/exchange-rate.validation';

function make(payload: TCreationOmits<IExchangeRate, 'currencyPair'>) {
  exchangeRateValidation.validateType(payload.type);
  dateUtils.validateDateIsNotInTheFuture(
    payload.asOf,
    exchangeRateError.InvalidDate
  );

  const baseCurrencyCode = currencyEntity.normalizeCode(
    payload.baseCurrencyCode
  );
  currencyEntity.validateCode(baseCurrencyCode);

  const targetCurrencyCode = currencyEntity.normalizeCode(
    payload.targetCurrencyCode
  );
  currencyEntity.validateCode(targetCurrencyCode);

  const currencyPair = getExchangeRateCurrencyPairHelper(
    baseCurrencyCode,
    targetCurrencyCode
  );
  const source = stringUtils.sanitizeAndValidate(
    payload.source,
    {
      min: 1,
      max: 100,
    },
    exchangeRateError.InvalidSource
  );

  const exchangeRate: IExchangeRate = {
    currencyPair,
    baseCurrencyCode,
    targetCurrencyCode,
    rate: payload.rate,
    asOf: payload.asOf,
    source,
    type: payload.type,
    createdAt: new Date(),
  };

  return Object.freeze(exchangeRate);
}

const exchangeRateValue = Object.freeze({
  make,
  ...exchangeRateValidation,
});

export default exchangeRateValue;
