import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';

import accountCashFlowMapper from '@app/reporting/dtos/account-cash-flow/account-cash-flow.dto.mapper';

describe('accountCashFlowMapper', () => {
  it('maps exact minor-unit amounts without exposing domain currency metadata', () => {
    const moneyIn = moneyValue.make(12345n, SYSTEM_CURRENCIES.USD, true);
    const moneyOut = moneyValue.make(50n, SYSTEM_CURRENCIES.USD, true);
    const period = { from: '2026-10-01', to: '2026-10-01' };
    const dto = accountCashFlowMapper.toDto('account-id', {
      period,
      totalMoneyIn: moneyIn,
      totalMoneyOut: moneyOut,
      buckets: [{ ...period, moneyIn, moneyOut }],
    });
    expect(dto).toEqual({
      accountId: 'account-id',
      currencyCode: 'USD',
      period,
      totalMoneyIn: { amount: 12345, currencyCode: 'USD', isMinorUnit: true },
      totalMoneyOut: { amount: 50, currencyCode: 'USD', isMinorUnit: true },
      buckets: [
        {
          ...period,
          moneyIn: { amount: 12345, currencyCode: 'USD', isMinorUnit: true },
          moneyOut: { amount: 50, currencyCode: 'USD', isMinorUnit: true },
        },
      ],
    });
  });
});
