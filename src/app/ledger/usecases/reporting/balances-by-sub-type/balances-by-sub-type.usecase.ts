/**
 * SUMMARY
 * Returns signed closing-balance series grouped by ledger type and subtype in
 * the selected entity's functional currency. Deduplicates the requested filters
 * and uses an inclusive UTC date range of at most 366 days with the requested
 * day-bucket size. Includes prior activity in opening balances, accumulates
 * movements through each bucket, and carries balances across gaps. Selected
 * account roots include descendant activity; signs follow each root's normal
 * balance. Excludes drafts, voided originals, and reversals. Returns bucket-end
 * dates and minor-unit closing balances; invalid periods or amounts reject.
 *
 * WHEN TO USE
 * Use to compare more detailed account classifications over time. These are
 * cumulative balances at each bucket end, not the movement within that bucket.
 *
 * SEQUENCE DIAGRAM
 * Not required for this read-only aggregation workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import dateUtils from '@shared/utils/date';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import currencyEntity from '@domain/money/entities/currency.entity';

import { IAppContextData } from '@app/context/types/app-context.types';
import type { TBalanceSeriesRepoQuery } from '@app/ledger/contracts/balance-series.repo-query.contract';
import buildBalanceSeriesHelper from '@app/ledger/usecases/helpers/reporting/build-balance-series.helper';
import { dateRangeMapper } from '@app/ledger/usecases/reporting/shared/date-range';
import reportingValidation from '@app/ledger/usecases/reporting/shared/reporting.validation';

import {
  getBalancesBySubTypeQueryValidationSchema,
  IBalancesBySubTypeDto,
  IGetBalancesBySubTypeQuery,
} from './dto';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  repoQuery: TBalanceSeriesRepoQuery;
}

export default function makeGetBalancesBySubTypeUsecase(deps: IDependencies) {
  return async (
    query: IGetBalancesBySubTypeQuery
  ): Promise<IBalancesBySubTypeDto> => {
    zodValidationRunner(getBalancesBySubTypeQueryValidationSchema, query);
    const period = dateRangeMapper.fromDto(query);
    const days = dateUtils.getUtcCalendarDistance(
      period.from,
      period.to,
      'day'
    );
    reportingValidation.validatePeriodDays(days);

    const { accountingEntity, correlationId } = deps.appContext.get([
      'accountingEntity',
    ]);
    const currency = currencyEntity.getByCode(
      accountingEntity.functionalCurrencyCode
    );
    const subTypes = [...new Set(query.subTypes)];

    const aggregates = await deps.repoQuery(
      {
        accountingEntityId: accountingEntity.id,
        currencyCode: currency.code,
        period,
        bucketDays: query.bucketDays,
        filter: { subTypes },
      },
      { correlationId }
    );
    return buildBalanceSeriesHelper(
      period,
      query.bucketDays,
      aggregates,
      currency,
      'subType'
    );
  };
}
