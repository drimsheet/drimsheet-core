import IAppContextService from '@shared/contracts/app-context.service.contract';
import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import batchArray from '@shared/utils/batch-array';
import dateUtils from '@shared/utils/date';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import IExchangeRateRepo from '@domain/money/repos/exchange-rate.repo';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';

import { IAppContextData } from '@app/context/types/app-context.types';
import IExchangeRateProvider from '@app/money/contracts/exchange-rate-provider.contract';
import { IExchangeRateIngestionDto } from '@app/money/dtos/exchange-rate/exchange-rate.dto';
import { exchangeRateIngestionDtoValidation } from '@app/money/dtos/exchange-rate/exchange-rate.dto.validation';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  exchangeRateRepo: IExchangeRateRepo;
  exchangeRateProvider: IExchangeRateProvider;
  repoService: IRepoService;
}

export default function makeIngestExchangeRateUseCase(deps: IDependencies) {
  return async (payload: IExchangeRateIngestionDto = {}) => {
    const now = dateUtils.now();
    const { startDate = dateUtils.addYearsToDate(now, -2), endDate = now } =
      payload;

    zodValidationRunner(exchangeRateIngestionDtoValidation, {
      startDate,
      endDate,
    });

    const { actor, correlationId } = deps.appContext.get(['actor']);

    const observations = await deps.exchangeRateProvider.fetch(
      startDate,
      endDate
    );

    const exchangeRates = observations.map((exchangeRate) =>
      exchangeRateValue.make({
        baseCurrencyCode: exchangeRate.baseCurrencyCode,
        targetCurrencyCode: exchangeRate.targetCurrencyCode,
        rate: exchangeRate.rate,
        type: exchangeRate.type,
        asOf: exchangeRate.asOf,
        source: exchangeRate.source,
      })
    );

    const currencyPairs = [
      ...new Set(exchangeRates.map((v) => v.currencyPair)),
    ];
    const latestExchangeRateDates = await deps.exchangeRateRepo.findLatest(
      currencyPairs,
      {
        correlationId,
      }
    );

    const latestAsOfByCurrencyPair = new Map(
      latestExchangeRateDates.map((v) => [v.currencyPair, v.asOf])
    );

    const selectedExchangeRates = exchangeRates.filter((v) => {
      const latestAsOf = latestAsOfByCurrencyPair.get(v.currencyPair);

      return !latestAsOf || v.asOf >= latestAsOf;
    });

    if (selectedExchangeRates.length === 0) {
      return Object.freeze({ processedCount: 0 });
    }

    const transactionFn: TRepoTransactionFn = async (tx) => {
      const batches = batchArray(selectedExchangeRates, 100);

      for (const batch of batches) {
        await deps.exchangeRateRepo.create(batch, actor.id, {
          tx,
          correlationId,
        });
      }
    };

    await deps.repoService.runInTransaction(transactionFn);

    return Object.freeze({ processedCount: selectedExchangeRates.length });
  };
}
