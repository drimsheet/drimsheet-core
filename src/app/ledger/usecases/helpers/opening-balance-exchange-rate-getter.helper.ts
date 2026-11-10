import { IExchangeRate } from '@domain/money/types/exchange-rate.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';

import { IOpeningBalanceDto } from '@app/journal-entry/dtos/opening-balance/opening-balance.dto';

export default function openingBalanceExchangeRateGetterHelper(
  openingBalance: IOpeningBalanceDto | null
): IExchangeRate | null {
  return openingBalance?.exchangeRate
    ? exchangeRateValue.make(openingBalance.exchangeRate)
    : null;
}
