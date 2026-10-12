import dateUtils from '@shared/utils/date';

import { ICurrency } from '@domain/money/types/currency.types';
import moneyValue from '@domain/money/values/money.vo';

import { IAccountCashFlowAggregate } from '@app/reporting/contracts/account-cash-flow.query.repo.contract';
import { IAccountCashFlowReport } from '@app/reporting/types/account-cash-flow.types';

/** Builds ordered, zero-filled buckets for a validated inclusive period. */
export default function buildAccountCashFlowBucketsHelper(
  from: string,
  days: number,
  bucketDays: number,
  aggregates: IAccountCashFlowAggregate[],
  currency: ICurrency
): IAccountCashFlowReport['buckets'] {
  const aggregatesByIndex = new Map(
    aggregates.map((bucket) => [bucket.bucketIndex, bucket])
  );
  const start = new Date(from);
  const buckets: IAccountCashFlowReport['buckets'] = [];

  for (let offset = 0; offset < days; offset += bucketDays) {
    const bucketIndex = Math.floor(offset / bucketDays);
    const aggregate = aggregatesByIndex.get(bucketIndex);
    const lastDayOffset = Math.min(offset + bucketDays - 1, days - 1);

    buckets.push({
      from: dateUtils
        .addUtcCalendarUnits(start, offset, 'day')
        .toISOString()
        .slice(0, 10),
      to: dateUtils
        .addUtcCalendarUnits(start, lastDayOffset, 'day')
        .toISOString()
        .slice(0, 10),
      moneyIn: moneyValue.make(aggregate?.moneyIn ?? 0n, currency, true),
      moneyOut: moneyValue.make(aggregate?.moneyOut ?? 0n, currency, true),
    });
  }

  return buckets;
}
