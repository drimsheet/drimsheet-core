import { IDateRange } from '@shared/types/date.types';
import dateUtils from '@shared/utils/date';

import { ULedgerType } from '@domain/ledger/types/ledger.types';
import { ICurrency } from '@domain/money/types/currency.types';
import { IMoney } from '@domain/money/types/money.types';
import moneyValue from '@domain/money/values/money.vo';

import moneyMapper from '@app/money/dtos/money/money.dto.mapper';
import { IBalanceSeriesAggregate } from '@app/reporting/contracts/balance-series.query.repo.contract';
import {
  IBalancesByAccountDto,
  IBalancesByBehaviorDto,
  IBalancesBySubTypeDto,
  IBalancesByTypeDto,
} from '@app/reporting/dtos/balance-series/balance-series.dto';
import dateRangeMapper from '@app/reporting/dtos/date/date-range.dto.mapper';
import reportingValidation from '@app/reporting/validations/reporting.validation';

function buildBalanceSeriesHelper(
  period: IDateRange,
  bucketDays: number,
  aggregates: IBalanceSeriesAggregate[],
  currency: ICurrency,
  grouping: 'type'
): IBalancesByTypeDto;
function buildBalanceSeriesHelper(
  period: IDateRange,
  bucketDays: number,
  aggregates: IBalanceSeriesAggregate[],
  currency: ICurrency,
  grouping: 'subType'
): IBalancesBySubTypeDto;
function buildBalanceSeriesHelper(
  period: IDateRange,
  bucketDays: number,
  aggregates: IBalanceSeriesAggregate[],
  currency: ICurrency,
  grouping: 'behavior'
): IBalancesByBehaviorDto;
function buildBalanceSeriesHelper(
  period: IDateRange,
  bucketDays: number,
  aggregates: IBalanceSeriesAggregate[],
  currency: ICurrency,
  grouping: 'account'
): IBalancesByAccountDto;

/**
 * Accumulates opening activity and bucket movements into signed closing
 * balances using each selected hierarchy root's normal side. Aggregates
 * already include the selected root's descendants.
 * Carries balances across gaps and retains zero groups in stable key order.
 * Serializes validated closing balances only when assembling the concrete DTO.
 */
function buildBalanceSeriesHelper(
  period: IDateRange,
  bucketDays: number,
  aggregates: IBalanceSeriesAggregate[],
  currency: ICurrency,
  grouping: 'type' | 'subType' | 'behavior' | 'account'
) {
  const groups = new Map<
    string,
    {
      accountId: string;
      type: ULedgerType;
      subType: string;
      behavior: string;
      balance: IMoney;
      movements: Map<number, IMoney>;
    }
  >();

  for (const aggregate of aggregates) {
    const key =
      grouping === 'account'
        ? aggregate.accountId
        : grouping === 'type'
          ? aggregate.type
          : grouping === 'subType'
            ? `${aggregate.type}/${aggregate.subType}`
            : `${aggregate.type}/${aggregate.subType}/${aggregate.behavior}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        accountId: aggregate.accountId,
        type: aggregate.type,
        subType: aggregate.subType,
        behavior: aggregate.behavior,
        balance: moneyValue.makeZeroAmount(currency),
        movements: new Map(),
      };
      groups.set(key, group);
    }

    const normalBalance = aggregate.normalBalance;
    const debits = moneyValue.make(aggregate.debits, currency, true);
    const credits = moneyValue.make(aggregate.credits, currency, true);
    const movement =
      normalBalance === 'debit'
        ? moneyValue.subtract(debits, credits)
        : moneyValue.subtract(credits, debits);
    const previous =
      group.movements.get(aggregate.bucketIndex) ??
      moneyValue.makeZeroAmount(currency);
    group.movements.set(
      aggregate.bucketIndex,
      moneyValue.add(previous, movement)
    );
  }

  const orderedGroups = [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map((entry) => entry[1]);
  for (const group of orderedGroups) {
    group.balance =
      group.movements.get(-1) ?? moneyValue.makeZeroAmount(currency);
  }
  const days = dateUtils.getUtcCalendarDistance(period.from, period.to, 'day');
  const buckets = [];
  for (let offset = 0; offset < days; offset += bucketDays) {
    const bucketIndex = Math.floor(offset / bucketDays);
    const balances = orderedGroups.map((group) => {
      const movement =
        group.movements.get(bucketIndex) ?? moneyValue.makeZeroAmount(currency);
      group.balance = moneyValue.add(group.balance, movement);
      reportingValidation.validateAmountLimit(group.balance);
      reportingValidation.validateSafeAmount(group.balance);
      const closingBalance = moneyMapper.toDto(group.balance);
      switch (grouping) {
        case 'account':
          return { accountId: group.accountId, closingBalance };
        case 'type':
          return { type: group.type, closingBalance };
        case 'subType':
          return { type: group.type, subType: group.subType, closingBalance };
        case 'behavior':
          return {
            type: group.type,
            subType: group.subType,
            behavior: group.behavior,
            closingBalance,
          };
      }
    });
    const lastOffset = Math.min(offset + bucketDays - 1, days - 1);
    buckets.push({
      date: dateUtils
        .addUtcCalendarUnits(period.from, lastOffset, 'day')
        .toISOString()
        .slice(0, 10),
      balances,
    });
  }
  return { period: dateRangeMapper.toDto(period), buckets };
}

export default buildBalanceSeriesHelper;
