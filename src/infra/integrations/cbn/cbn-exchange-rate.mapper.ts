import { IExchangeRateDto } from '@app/money/dtos/exchange-rate/exchange-rate.dto';

import { TCbnExchangeRateRecord } from './cbn-exchange-rate.schema';

const CBN_CURRENCY_CODE_BY_LABEL: Readonly<Record<string, string>> =
  Object.freeze({
    AED: 'AED',
    CFA: 'XOF',
    CHF: 'CHF',
    CNY: 'CNY',
    'DANISH KRONA': 'DKK',
    'DANISH KRONE': 'DKK',
    'DANISH KRONER': 'DKK',
    DKK: 'DKK',
    EUR: 'EUR',
    EURO: 'EUR',
    GBP: 'GBP',
    'JAPANESE YEN': 'JPY',
    JPY: 'JPY',
    'POUND STERLING': 'GBP',
    'POUNDS STERLING': 'GBP',
    RIYAL: 'SAR',
    SAR: 'SAR',
    'SOUTH AFRICAN RAND': 'ZAR',
    'SWISS FRANC': 'CHF',
    'UAE DIRHAM': 'AED',
    'US DOLLAR': 'USD',
    USD: 'USD',
    XOF: 'XOF',
    YEN: 'JPY',
    YUAN: 'CNY',
    'YUAN/RENMINBI': 'CNY',
    ZAR: 'ZAR',
  });

interface ICbnExchangeRateMapping {
  exchangeRates: IExchangeRateDto[];
  unsupportedCurrencyLabels: string[];
}

function normalizeCbnCurrencyLabel(currency: string): string {
  return currency.trim().replace(/\s+/g, ' ').toUpperCase();
}

export function mapCbnExchangeRates(
  records: TCbnExchangeRateRecord[],
  startDate: Date,
  endDate: Date
): ICbnExchangeRateMapping {
  const exchangeRates: IExchangeRateDto[] = [];
  const unsupportedCurrencyLabels = new Set<string>();

  for (const record of records) {
    const normalizedCurrencyLabel = normalizeCbnCurrencyLabel(record.currency);
    const baseCurrencyCode =
      CBN_CURRENCY_CODE_BY_LABEL[
        normalizedCurrencyLabel as keyof typeof CBN_CURRENCY_CODE_BY_LABEL
      ];

    if (!baseCurrencyCode) {
      unsupportedCurrencyLabels.add(normalizedCurrencyLabel);
      continue;
    }

    const asOf = new Date(`${record.ratedate}T00:00:00.000Z`);
    const isOutsideRange = asOf < startDate || asOf > endDate;
    if (isOutsideRange) {
      continue;
    }

    exchangeRates.push({
      asOf,
      baseCurrencyCode,
      rate: Number(record.centralrate),
      source: 'CBN',
      targetCurrencyCode: 'NGN',
      type: 'official',
    });
  }

  return Object.freeze({
    exchangeRates,
    unsupportedCurrencyLabels: [...unsupportedCurrencyLabels].sort(),
  });
}
