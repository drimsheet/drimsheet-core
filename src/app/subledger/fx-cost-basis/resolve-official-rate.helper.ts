import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IJournalEntry } from '@domain/journal-entry/types/journal-entry.types';
import { IExchangeRate } from '@domain/money/types/exchange-rate.types';

import IExchangeRateAppService from '@app/money/contracts/exchange-rate.service.contract';

export default async function resolveOfficialRateHelper(
  exchangeRateAppService: IExchangeRateAppService,
  lines: IJournalEntry['lines'],
  accountId: TEntityId,
  repoOptions: IReadRepoOptions
): Promise<IExchangeRate | null> {
  const accountLines = lines.filter((line) => line.accountId === accountId);
  const transactionRate =
    accountLines.length === 1 ? accountLines[0].exchangeRate : null;

  if (!transactionRate) {
    return null;
  }

  return exchangeRateAppService.getOfficialRate(
    transactionRate.currencyPair,
    transactionRate.asOf,
    repoOptions,
    transactionRate
  );
}
