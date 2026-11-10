import generateUUID from '@shared/utils/uuid-generator';

import {
  EJournalSide,
  IJournalLine,
} from '@domain/journal-entry/types/journal-line.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import {
  EExchangeRateType,
  IExchangeRate,
} from '@domain/money/types/exchange-rate.types';
import moneyValue from '@domain/money/values/money.vo';

import mockExchangeRateAppService from '@app/money/contracts/__mocks__/exchange-rate.service.mock';
import resolveOfficialRateHelper from '@app/subledger/fx-cost-basis/resolve-official-rate.helper';

describe('resolveOfficialRateHelper', () => {
  const accountId = generateUUID();
  const date = new Date('2026-08-01T00:00:00Z');
  const repoOptions = { correlationId: 'resolve-official-rate', tx: {} };
  const transactionRate: IExchangeRate = {
    currencyPair: 'USD/NGN',
    baseCurrencyCode: 'USD',
    targetCurrencyCode: 'NGN',
    rate: 1500,
    asOf: date,
    type: EExchangeRateType.Negotiated,
    source: 'bank',
    createdAt: date,
  };
  const officialRate = {
    ...transactionRate,
    type: EExchangeRateType.Official,
  };
  const line: IJournalLine = {
    id: generateUUID(),
    entryId: generateUUID(),
    accountId,
    counterpartyId: null,
    sequenceOrder: 1,
    amount: moneyValue.make(100, SYSTEM_CURRENCIES.USD, false),
    functionalAmount: moneyValue.make(150000, SYSTEM_CURRENCIES.NGN, false),
    exchangeRate: transactionRate,
    side: EJournalSide.Debit,
    description: null,
    meta: null,
    version: 1,
    createdAt: date,
    updatedAt: date,
    createdBy: generateUUID(),
  };

  beforeEach(() => {
    mockExchangeRateAppService.getOfficialRate.mockReset();
  });

  it.each([
    ['no matching line', [{ ...line, accountId: generateUUID() }]],
    ['no transaction rate', [{ ...line, exchangeRate: null }]],
    ['ambiguous lines', [line, { ...line, id: generateUUID() }]],
  ] as const)('skips the lookup for %s', async (_, lines) => {
    await expect(
      resolveOfficialRateHelper(
        mockExchangeRateAppService,
        [...lines],
        accountId,
        repoOptions
      )
    ).resolves.toBeNull();
    expect(mockExchangeRateAppService.getOfficialRate).not.toHaveBeenCalled();
  });

  it.each([officialRate, null])(
    'returns the lookup result (%p)',
    async (rate) => {
      mockExchangeRateAppService.getOfficialRate.mockResolvedValue(rate);

      await expect(
        resolveOfficialRateHelper(
          mockExchangeRateAppService,
          [{ ...line, accountId: generateUUID() }, line],
          accountId,
          repoOptions
        )
      ).resolves.toBe(rate);
      expect(mockExchangeRateAppService.getOfficialRate).toHaveBeenCalledWith(
        transactionRate.currencyPair,
        transactionRate.asOf,
        repoOptions,
        transactionRate
      );
    }
  );

  it('propagates a lookup failure', async () => {
    const failure = new Error('official rate lookup failed');
    mockExchangeRateAppService.getOfficialRate.mockRejectedValue(failure);

    await expect(
      resolveOfficialRateHelper(
        mockExchangeRateAppService,
        [line],
        accountId,
        repoOptions
      )
    ).rejects.toBe(failure);
  });
});
