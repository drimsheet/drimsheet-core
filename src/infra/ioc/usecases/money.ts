import makeGetCurrenciesUseCase from '@app/money/usecases/get-currencies.usecase';
import makeGetExchangeRateUseCase from '@app/money/usecases/get-exchange-rates.usecase';
import makeIngestExchangeRateUseCase from '@app/money/usecases/ingest-exchange-rate.usecase';

import { repoService } from '@infra/ioc/services/repo';
import observability from '@infra/observability';
import { makeTracedUseCase } from '@infra/observability/usecase-tracing';
import currencyRepos from '@infra/persistence/repos/money';
import appContext from '@infra/services/app-context.service';

export const getAllCurrenciesUseCase = makeTracedUseCase(
  'money.getAllCurrenciesUseCase',
  makeGetCurrenciesUseCase({
    currencyRepo: currencyRepos.currency,
    appContext,
  })
);

export const ingestExchangeRateUseCase = makeTracedUseCase(
  'money.ingestExchangeRateUseCase',
  makeIngestExchangeRateUseCase({
    appContext,
    exchangeRateRepo: currencyRepos.exchangeRate,
    repoService,
  })
);

export const getExchangeRateUseCase = makeTracedUseCase(
  'money.getExchangeRateUseCase',
  makeGetExchangeRateUseCase({
    exchangeRateRepo: currencyRepos.exchangeRate,
    appContext,
  })
);
