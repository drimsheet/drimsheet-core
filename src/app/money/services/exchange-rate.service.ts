import IExchangeRateRepo from '@domain/money/repos/exchange-rate.repo';
import { EExchangeRateType } from '@domain/money/types/exchange-rate.types';

import IExchangeRateAppService from '@app/money/contracts/exchange-rate.service.contract';

interface IDependencies {
  exchangeRateRepo: IExchangeRateRepo;
}

/** Prefer an explicitly supplied official rate; otherwise read the stored rate. */
function makeGetOfficialRate(
  deps: IDependencies
): IExchangeRateAppService['getOfficialRate'] {
  return async (pair, asOf, repoOptions, userProvided) => {
    if (userProvided?.type === EExchangeRateType.Official) {
      return userProvided;
    }
    return deps.exchangeRateRepo.findByPairAndDate(pair, asOf, repoOptions);
  };
}

export default function makeExchangeRateAppService(
  deps: IDependencies
): IExchangeRateAppService {
  return Object.freeze({
    getOfficialRate: makeGetOfficialRate(deps),
  });
}
