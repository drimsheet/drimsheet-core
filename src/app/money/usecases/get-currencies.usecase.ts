/**
 * SUMMARY
 * Lists supported currencies with their code, symbol, name, and minor-unit
 * precision. Returns an array from the currency catalogue without requiring a
 * selected accounting entity.
 *
 * WHEN TO USE
 * Use to populate currency choices or obtain currency metadata for monetary
 * input and display.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';

import ICurrencyRepo from '@domain/money/repos/currency.repo';

import { IAppContextData } from '@app/context/types/app-context.types';
import { ICurrencyDto } from '@app/money/dtos/currency/currency.dto';

interface IDependencies {
  currencyRepo: ICurrencyRepo;
  appContext: IAppContextService<IAppContextData>;
}

export default function makeGetCurrenciesUseCase(deps: IDependencies) {
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
