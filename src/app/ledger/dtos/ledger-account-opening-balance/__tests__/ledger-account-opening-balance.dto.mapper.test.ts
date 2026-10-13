import { TEntityId } from '@shared/types/uuid';

import { IJournalEntry } from '@domain/journal-entry/types/journal-entry.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';

import ledgerAccountOpeningBalanceDtoMapper from '@app/ledger/dtos/ledger-account-opening-balance/ledger-account-opening-balance.dto.mapper';

const accountId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const date = new Date('2026-10-01T00:00:00Z');
const rate = {
  currencyPair: 'USD/NGN',
  baseCurrencyCode: 'USD',
  targetCurrencyCode: 'NGN',
  rate: 1500,
  type: 'market' as const,
  asOf: date,
  source: 'manual',
  createdAt: date,
};
const entry = {
  effectiveDate: date,
  lines: [
    {
      accountId: 'equity',
      amount: moneyValue.make(9900, SYSTEM_CURRENCIES.NGN, true),
      exchangeRate: null,
    },
    {
      accountId,
      amount: moneyValue.make(2550, SYSTEM_CURRENCIES.USD, true),
      exchangeRate: rate,
    },
  ],
} as IJournalEntry;

describe('ledgerAccountOpeningBalanceDtoMapper', () => {
  it('maps the account line amount, date and exchange rate without internal fields', () => {
    expect(
      ledgerAccountOpeningBalanceDtoMapper.toDto(entry, accountId)
    ).toEqual({
      openingBalance: {
        amount: { amount: 2550, currencyCode: 'USD', isMinorUnit: true },
        date,
        exchangeRate: {
          baseCurrencyCode: 'USD',
          targetCurrencyCode: 'NGN',
          rate: 1500,
          type: 'market',
          asOf: date,
          source: 'manual',
        },
      },
    });
  });
  it('retains zero as an existing balance and a null exchange rate', () => {
    const zeroEntry = {
      ...entry,
      lines: [
        {
          ...entry.lines[1],
          amount: moneyValue.make(0, SYSTEM_CURRENCIES.USD, true),
          exchangeRate: null,
        },
      ],
    };
    expect(
      ledgerAccountOpeningBalanceDtoMapper.toDto(zeroEntry, accountId)
    ).toEqual({
      openingBalance: {
        amount: { amount: 0, currencyCode: 'USD', isMinorUnit: true },
        date,
        exchangeRate: null,
      },
    });
  });
  it('returns null for no entry', () => {
    expect(
      ledgerAccountOpeningBalanceDtoMapper.toDto(undefined, accountId)
    ).toEqual({ openingBalance: null });
  });
  it('does not use another account line', () => {
    expect(
      ledgerAccountOpeningBalanceDtoMapper.toDto(entry, 'other' as TEntityId)
    ).toEqual({ openingBalance: null });
  });
});
