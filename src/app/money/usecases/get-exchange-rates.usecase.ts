/**
 * SUMMARY
 * Retrieves stored exchange-rate observations for a currency pair, with
 * optional rate-type and as-of filters. Returns the matching rate array without
 * fetching new observations from the external provider. Does not require a
 * selected accounting entity.
 *
 * WHEN TO USE
 * Use to inspect available stored rates for a currency pair. Use ingest-
 * exchange-rate to import provider observations.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import IExchangeRateRepo from '@domain/money/repos/exchange-rate.repo';

import { IAppContextData } from '@app/context/types/app-context.types';
import { IExchangeRateQueryParam } from '@app/money/dtos/exchange-rate/exchange-rate.dto';
import { getExchangeRatesQueryValidationSchema } from '@app/money/dtos/exchange-rate/exchange-rate.dto.validation';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  exchangeRateRepo: IExchangeRateRepo;
}

export default function makeGetExchangeRateUseCase(deps: IDependencies) {
  return async (query: IExchangeRateQueryParam) => {
    zodValidationRunner(getExchangeRatesQueryValidationSchema, query);

    const { correlationId } = deps.appContext.get();

    const response = await deps.exchangeRateRepo.find(query, { correlationId });

    return response;
  };
}
