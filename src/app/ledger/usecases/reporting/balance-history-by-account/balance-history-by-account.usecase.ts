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
import dateRangeValue from '@shared/values/date-range/date-range.vo';

import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import currencyEntity from '@domain/money/entities/currency.entity';

import { IAppContextData } from '@app/context/types/app-context.types';
import type { TBalanceHistoryRepoQuery } from '@app/ledger/contracts/balance-history.repo-query.contract';
import reportingError from '@app/ledger/errors/reporting.error';
import buildBalanceHistoryHelper from '@app/ledger/usecases/helpers/reporting/build-balance-history.helper';
import { dateRangeMapper } from '@app/ledger/usecases/reporting/shared/date-range';
import reportingValidation from '@app/ledger/usecases/reporting/shared/reporting.validation';

import {
  getBalanceHistoryByAccountQueryValidationSchema,
  IBalanceHistoryByAccountDto,
  IGetBalanceHistoryByAccountQuery,
} from './dto';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  repoQuery: TBalanceHistoryRepoQuery;
  ledgerAccountRepo: ILedgerAccountRepo;
}

export default function makeGetBalanceHistoryByAccountUsecase(
  deps: IDependencies
) {
  return async (
    query: IGetBalanceHistoryByAccountQuery
  ): Promise<IBalanceHistoryByAccountDto> => {
    zodValidationRunner(getBalanceHistoryByAccountQueryValidationSchema, query);

    const periodBounds = dateRangeMapper.fromDto(query);
    const days = dateUtils.getUtcCalendarDistance(
      periodBounds.from,
      periodBounds.to,
      'day'
    );
    reportingValidation.validatePeriodDays(days);
    const period = dateRangeValue.make(periodBounds);

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
    return buildBalanceHistoryHelper(
      period,
      query.bucketDays,
      aggregates,
      currency,
      'account'
    );
  };
}
