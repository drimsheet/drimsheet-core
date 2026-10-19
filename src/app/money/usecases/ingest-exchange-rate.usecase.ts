import IAppContextService from '@shared/contracts/app-context.service.contract';
import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import batchArray from '@shared/utils/batch-array';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import IExchangeRateRepo from '@domain/money/repos/exchange-rate.repo';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';

import { IAppContextData } from '@app/context/types/app-context.types';
import { IExchangeRateIngestionDto } from '@app/money/dtos/exchange-rate/exchange-rate.dto';
import { exchangeRateIngestionDtoValidation } from '@app/money/dtos/exchange-rate/exchange-rate.dto.validation';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  exchangeRateRepo: IExchangeRateRepo;
  repoService: IRepoService;
}

export default function makeIngestExchangeRateUseCase(deps: IDependencies) {
  return async (payload: IExchangeRateIngestionDto) => {
    zodValidationRunner(exchangeRateIngestionDtoValidation, payload);

    const { actor } = deps.appContext.get(['actor']);

    const exchangeRates = payload.exchangeRates.map((exchangeRate) =>
      exchangeRateValue.make({
        baseCurrencyCode: exchangeRate.baseCurrencyCode,
        targetCurrencyCode: exchangeRate.targetCurrencyCode,
        rate: exchangeRate.rate,
        type: exchangeRate.type,
        asOf: exchangeRate.asOf,
        source: exchangeRate.source,
      })
    );

    if (exchangeRates.length === 0) {
      return Object.freeze({ processedCount: 0 });
    }

    const currencyPairs = [
      ...new Set(exchangeRates.map((v) => v.currencyPair)),
    ];
    const latestExchangeRateDates = await deps.exchangeRateRepo.findLatest(
      currencyPairs,
      {
        correlationId: payload.correlationId,
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
          correlationId: payload.correlationId,
        });
      }
    };

    await deps.repoService.runInTransaction(transactionFn);

    return Object.freeze({ processedCount: selectedExchangeRates.length });
  };
}
