import currencyEntity from '@domain/money/entities/currency.entity';

function getExchangeRateCurrencyPairHelper(
  baseCode: string,
  targetCode: string
) {
  currencyEntity.validateCode(baseCode);
  currencyEntity.validateCode(targetCode);

  return `${baseCode}/${targetCode}`;
}

export default getExchangeRateCurrencyPairHelper;
