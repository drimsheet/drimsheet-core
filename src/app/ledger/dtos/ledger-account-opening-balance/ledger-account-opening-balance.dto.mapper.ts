import { TEntityId } from '@shared/types/uuid';

import { IJournalEntry } from '@domain/journal-entry/types/journal-entry.types';

import moneyMapper from '@app/money/dtos/money/money.dto.mapper';

import { ILedgerAccountOpeningBalanceDto } from './ledger-account-opening-balance.dto';

const ledgerAccountOpeningBalanceDtoMapper = {
  toDto(
    entry: IJournalEntry | undefined,
    accountId: TEntityId
  ): ILedgerAccountOpeningBalanceDto {
    const line = entry?.lines.find((line) => line.accountId === accountId);
    const hasOpeningBalance = entry !== undefined && line !== undefined;
    if (!hasOpeningBalance) {
      return { openingBalance: null };
    }

    const rate = line.exchangeRate;
    return {
      openingBalance: {
        amount: moneyMapper.toDto(line.amount),
        date: entry.effectiveDate,
        exchangeRate: rate
          ? {
              baseCurrencyCode: rate.baseCurrencyCode,
              targetCurrencyCode: rate.targetCurrencyCode,
              rate: rate.rate,
              type: rate.type,
              asOf: rate.asOf,
              source: rate.source,
            }
          : null,
      },
    };
  },
};

export default ledgerAccountOpeningBalanceDtoMapper;
