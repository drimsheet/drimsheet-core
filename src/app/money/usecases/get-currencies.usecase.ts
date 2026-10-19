import IAppContextService from '@shared/contracts/app-context.service.contract';

import ICurrencyRepo from '@domain/money/repos/currency.repo';

import { IAppContextData } from '@app/context/types/app-context.types';
import { ICurrencyDto } from '@app/money/dtos/currency/currency.dto';

interface IDependencies {
  currencyRepo: ICurrencyRepo;
  appContext: IAppContextService<IAppContextData>;
}

export default function makeGetCurrenciesUseCase(deps: IDependencies) {
  /**
   * ========= USECASE EXECUTOR =========
   *
   * DOMAIN: global
   *
   * This usecase is used to get all supported currencies
   */
  return async (): Promise<ICurrencyDto[]> => {
    const { correlationId } = deps.appContext.get();

    const res = await deps.currencyRepo.findAll({
      correlationId,
    });

    return res.map((currency) => ({
      code: currency.code,
      symbol: currency.symbol,
      name: currency.name,
      minorUnit: currency.minorUnit,
    }));
  };
}
