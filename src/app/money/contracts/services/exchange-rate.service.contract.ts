import { IReadRepoOptions } from '@shared/types/repo.types';

import { IExchangeRate } from '@domain/money/types/exchange-rate.types';

export default interface IExchangeRateAppService {
  getOfficialRate(
    pair: string,
    asOf: Date,
    repoOptions: IReadRepoOptions,
    userProvided: IExchangeRate | null
  ): Promise<IExchangeRate | null>;
}
