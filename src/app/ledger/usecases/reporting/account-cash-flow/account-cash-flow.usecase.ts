/**
 * SUMMARY
 * Reports money in and money out for one eligible bank or petty-cash posting
 * account in the selected entity, using its own currency. Requires a non-draft,
 * non-deleted, debit-normal cash account with a fixed currency; control and
 * adjustment accounts are excluded. Uses an inclusive UTC date range of at most
 * 366 days, grouped into day buckets with zero-filled gaps. Excludes drafts,
 * voided originals, reversals, and opening balances. Returns period totals and
 * bucket amounts in minor units; missing or unsupported accounts and invalid
 * amounts reject.
 *
 * WHEN TO USE
 * Use to chart cash movement for a particular cash account over a period. This
 * reports flows, not running or closing balances.
 *
 * SEQUENCE DIAGRAM
 * Not required for this read-only aggregation workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import dateUtils from '@shared/utils/date';
import stringUtils from '@shared/utils/string';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import dateRangeValue from '@shared/values/date-range/date-range.vo';
import { IDateRange } from '@shared/values/date-range/types/date-range.types';

import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import {
  EAssetAccountBehavior,
  EAssetSubType,
} from '@domain/ledger/types/asset-account.types';
import {
  ELedgerAccountStatus,
  ELedgerType,
  ENormalBalance,
} from '@domain/ledger/types/ledger.types';
import { UCurrencyCode } from '@domain/money/config/currencies.config';
import { ICurrency } from '@domain/money/types/currency.types';
import moneyValue from '@domain/money/values/money.vo';

import { IAppContextData } from '@app/context/types/app-context.types';
import reportingError from '@app/ledger/errors/reporting.error';
import { dateRangeMapper } from '@app/ledger/usecases/reporting/shared/date-range';
import reportingValidation from '@app/ledger/usecases/reporting/shared/reporting.validation';

import {
  accountCashFlowMapper,
  getAccountCashFlowQueryValidationSchema,
  IAccountCashFlowDto,
  IGetAccountCashFlowQuery,
} from './dto';
import { IAccountCashFlowReport } from './types';

export interface IGetAccountCashFlowRepoQueryInput extends IDateRange {
  bucketDays: number;
  accountId: TEntityId;
  accountingEntityId: TEntityId;
  currencyCode: UCurrencyCode;
}

export interface IGetAccountCashFlowRepoQueryOutput {
  bucketIndex: number;
  moneyIn: bigint;
  moneyOut: bigint;
}

/**
 * Reads transaction-currency cash movements by effective date. Excludes drafts,
 * never-posted entries, entries with voidingEntryId, reversals and opening balances.
 * Returns only populated buckets, ordered by zero-based index, with exact minor
 * units. Does not persist, convert currencies or return journal entities.
 */
export type TGetAccountCashFlowRepoQuery = (
  input: IGetAccountCashFlowRepoQueryInput,
  options: IReadRepoOptions
) => Promise<IGetAccountCashFlowRepoQueryOutput[]>;

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  ledgerAccountRepo: ILedgerAccountRepo;
  repoQuery: TGetAccountCashFlowRepoQuery;
}

export default function makeGetAccountCashFlowUsecase(deps: IDependencies) {
  return async (
    accountId: string,
    query: IGetAccountCashFlowQuery
  ): Promise<IAccountCashFlowDto> => {
    stringUtils.validateUUID(accountId, reportingError.InvalidAccountId);
    zodValidationRunner(getAccountCashFlowQueryValidationSchema, query);

    const periodBounds = dateRangeMapper.fromDto(query);
    const days = dateUtils.getUtcCalendarDistance(
      periodBounds.from,
      periodBounds.to,
      'day'
    );
    reportingValidation.validatePeriodDays(days);
    const period = dateRangeValue.make(periodBounds);

    const { correlationId, accountingEntity } = deps.appContext.get([
      'accountingEntity',
    ]);

    const repoOptions = { correlationId };

    const account = await deps.ledgerAccountRepo.findById(
      accountId as TEntityId,
      accountingEntity.id,
      repoOptions
    );
    if (!account) {
      throw new reportingError.AccountNotFound();
    }

    const isCashBehavior =
      account.behavior === EAssetAccountBehavior.Bank ||
      account.behavior === EAssetAccountBehavior.PettyCash;
    const isAdjustmentAccount =
      account.meta !== null && 'adjustmentType' in account.meta;

    const isEligible =
      account.type === ELedgerType.Asset &&
      account.subType === EAssetSubType.CashAndCashEquivalent &&
      isCashBehavior &&
      !isAdjustmentAccount &&
      !account.isControlAccount &&
      account.normalBalance === ENormalBalance.Debit &&
      account.status !== ELedgerAccountStatus.Draft &&
      account.deletedAt === null;

    if (!isEligible) {
      throw new reportingError.UnsupportedAccount();
    }

    const { currency } = account;
    if (!currency) {
      throw new reportingError.UnsupportedAccount();
    }

    const aggregates = await deps.repoQuery(
      {
        accountId: accountId as TEntityId,
        accountingEntityId: accountingEntity.id,
        currencyCode: currency.code,
        from: period.from,
        to: period.to,
        bucketDays: query.bucketDays,
      },
      repoOptions
    );

    const buckets = buildAccountCashFlowBuckets(
      period.from,
      days,
      query.bucketDays,
      aggregates,
      currency
    );
    const totalMoneyIn = moneyValue.add(
      ...buckets.map((bucket) => bucket.moneyIn)
    );
    const totalMoneyOut = moneyValue.add(
      ...buckets.map((bucket) => bucket.moneyOut)
    );
    const cashFlowAmounts = [
      totalMoneyIn,
      totalMoneyOut,
      ...buckets.flatMap((bucket) => [bucket.moneyIn, bucket.moneyOut]),
    ];
    for (const money of cashFlowAmounts) {
      if (money.amount < 0n) {
        throw new reportingError.AmountOutOfRange();
      }
    }
    reportingValidation.validateAmountLimit(totalMoneyIn);
    reportingValidation.validateAmountLimit(totalMoneyOut);
    for (const money of cashFlowAmounts) {
      reportingValidation.validateSafeAmount(money);
    }

    const report = {
      period,
      totalMoneyIn,
      totalMoneyOut,
      buckets,
    };
    return accountCashFlowMapper.toDto(accountId, report);
  };
}

/** Builds ordered, zero-filled buckets for a validated inclusive period. */
function buildAccountCashFlowBuckets(
  from: Date,
  days: number,
  bucketDays: number,
  aggregates: IGetAccountCashFlowRepoQueryOutput[],
  currency: ICurrency
): IAccountCashFlowReport['buckets'] {
  const aggregatesByIndex = new Map(
    aggregates.map((bucket) => [bucket.bucketIndex, bucket])
  );
  const buckets: IAccountCashFlowReport['buckets'] = [];

  for (let offset = 0; offset < days; offset += bucketDays) {
    const bucketIndex = Math.floor(offset / bucketDays);
    const aggregate = aggregatesByIndex.get(bucketIndex);
    const lastDayOffset = Math.min(offset + bucketDays - 1, days - 1);

    const bucketRange = dateRangeValue.make({
      from: dateUtils.addUtcCalendarUnits(from, offset, 'day'),
      to: dateUtils.addUtcCalendarUnits(from, lastDayOffset, 'day'),
    });
    buckets.push({
      from: bucketRange.from,
      to: bucketRange.to,
      moneyIn: moneyValue.make(aggregate?.moneyIn ?? 0n, currency, true),
      moneyOut: moneyValue.make(aggregate?.moneyOut ?? 0n, currency, true),
    });
  }

  return buckets;
}
