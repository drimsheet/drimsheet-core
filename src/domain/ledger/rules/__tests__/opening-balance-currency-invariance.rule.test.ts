import generateUUID from '@shared/utils/uuid-generator';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import openingBalanceCurrencyInvarianceRule from '@domain/ledger/rules/opening-balance-currency-invariance.rule';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

describe('opening balance currency invariance rule', () => {
  it('accepts an opening balance in the account currency', () => {
    expect(() =>
      openingBalanceCurrencyInvarianceRule.validate(
        { id: generateUUID(), currency: SYSTEM_CURRENCIES.NGN },
        SYSTEM_CURRENCIES.NGN
      )
    ).not.toThrow();
  });

  it('rejects an opening balance in another currency', () => {
    expect(() =>
      openingBalanceCurrencyInvarianceRule.validate(
        { id: generateUUID(), currency: SYSTEM_CURRENCIES.NGN },
        SYSTEM_CURRENCIES.USD
      )
    ).toThrow(ledgerAccountError.OpeningBalanceCurrencyMismatch);
  });
  it('rejects an opening balance when the account has no fixed currency', () => {
    const accountId = generateUUID();
    expect(() =>
      openingBalanceCurrencyInvarianceRule.validate(
        { id: accountId, currency: null },
        SYSTEM_CURRENCIES.NGN
      )
    ).toThrow(
      new ledgerAccountError.OpeningBalanceCurrencyMismatch({
        accountId,
        accountCurrencyCode: null,
        openingBalanceCurrencyCode: 'NGN',
      })
    );
  });
});
