/**
 * SUMMARY
 * Returns signed closing-balance series grouped by account ID in the selected
 * entity's functional currency. Deduplicates the requested filters and uses an
 * inclusive UTC date range of at most 366 days with the requested day-bucket
 * size. Includes prior activity in opening balances, accumulates movements
 * through each bucket, and carries balances across gaps. Selected account roots
 * include descendant activity; signs follow each root's normal balance.
 * Excludes drafts, voided originals, and reversals. Returns bucket-end dates
 * and minor-unit closing balances; invalid periods or amounts reject. Rejects
 * any requested account absent from the selected entity.
 *
 * WHEN TO USE
 * Use to compare selected accounts, including the activity of their
 * descendants. These are cumulative balances at each bucket end, not the
 * movement within that bucket.
 *
 * SEQUENCE DIAGRAM
 * Not required for this read-only aggregation workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import { TEntityId } from '@shared/types/uuid';
import dateUtils from '@shared/utils/date';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import currencyEntity from '@domain/money/entities/currency.entity';

import { IAppContextData } from '@app/context/types/app-context.types';
import type { TBalanceSeriesRepoQuery } from '@app/ledger/contracts/balance-series.repo-query.contract';
import reportingError from '@app/ledger/errors/reporting.error';
import buildBalanceSeriesHelper from '@app/ledger/usecases/reporting/balance-series/build-balance-series.helper';
import {
  getBalancesByAccountQueryValidationSchema,
  IBalancesByAccountDto,
  IGetBalancesByAccountQuery,
} from '@app/ledger/usecases/reporting/balance-series/dto';
import { dateRangeMapper } from '@app/ledger/usecases/reporting/shared/date-range';
import reportingValidation from '@app/ledger/usecases/reporting/shared/reporting.validation';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  repoQuery: TBalanceSeriesRepoQuery;
  ledgerAccountRepo: ILedgerAccountRepo;
}

export default function makeGetBalancesByAccountUsecase(deps: IDependencies) {
  return async (
    query: IGetBalancesByAccountQuery
  ): Promise<IBalancesByAccountDto> => {
    zodValidationRunner(getBalancesByAccountQueryValidationSchema, query);

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
    const accountIds = [...new Set(query.accountIds)];

    for (const accountId of accountIds) {
      const account = await deps.ledgerAccountRepo.findById(
        accountId as TEntityId,
        accountingEntity.id,
        { correlationId }
      );
      if (!account) {
        throw new reportingError.AccountNotFound();
      }
    }

    const aggregates = await deps.repoQuery(
      {
        accountingEntityId: accountingEntity.id,
        currencyCode: currency.code,
        period,
        bucketDays: query.bucketDays,
        filter: { accountIds },
      },
      { correlationId }
    );
    return buildBalanceSeriesHelper(
      period,
      query.bucketDays,
      aggregates,
      currency,
      'account'
    );
  };
}
