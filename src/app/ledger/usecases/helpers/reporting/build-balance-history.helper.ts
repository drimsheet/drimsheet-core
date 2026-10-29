import dateUtils from '@shared/utils/date';
import { IDateRange } from '@shared/values/date-range/types/date-range.types';

import { ULedgerType } from '@domain/ledger/types/ledger.types';
import { ICurrency } from '@domain/money/types/currency.types';
import { IMoney } from '@domain/money/types/money.types';
import moneyValue from '@domain/money/values/money.vo';

import { IBalanceHistoryRepoQueryOutput } from '@app/ledger/contracts/balance-history.repo-query.contract';
import { IBalanceHistoryByAccountDto } from '@app/ledger/usecases/reporting/balance-history-by-account/dto';
import { IBalanceHistoryByBehaviorDto } from '@app/ledger/usecases/reporting/balance-history-by-behavior/dto';
import { IBalanceHistoryBySubTypeDto } from '@app/ledger/usecases/reporting/balance-history-by-sub-type/dto';
import { IBalanceHistoryByTypeDto } from '@app/ledger/usecases/reporting/balance-history-by-type/dto';
import { dateRangeMapper } from '@app/ledger/usecases/reporting/shared/date-range';
import reportingValidation from '@app/ledger/usecases/reporting/shared/reporting.validation';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';

function buildBalanceHistoryHelper(
  period: IDateRange,
  bucketDays: number,
  aggregates: IBalanceHistoryRepoQueryOutput[],
  currency: ICurrency,
  grouping: 'type'
): IBalanceHistoryByTypeDto;
function buildBalanceHistoryHelper(
  period: IDateRange,
  bucketDays: number,
  aggregates: IBalanceHistoryRepoQueryOutput[],
  currency: ICurrency,
  grouping: 'subType'
): IBalanceHistoryBySubTypeDto;
function buildBalanceHistoryHelper(
  period: IDateRange,
  bucketDays: number,
  aggregates: IBalanceHistoryRepoQueryOutput[],
  currency: ICurrency,
  grouping: 'behavior'
): IBalanceHistoryByBehaviorDto;
function buildBalanceHistoryHelper(
  period: IDateRange,
  bucketDays: number,
  aggregates: IBalanceHistoryRepoQueryOutput[],
  currency: ICurrency,
  grouping: 'account'
): IBalanceHistoryByAccountDto;

/**
 * Accumulates opening activity and bucket movements into signed closing
 * balances using each selected hierarchy root's normal side. Aggregates
 * already include the selected root's descendants.
 * Carries balances across gaps and retains zero groups in stable key order.
 * Serializes validated closing balances only when assembling the concrete DTO.
 */
function buildBalanceHistoryHelper(
  period: IDateRange,
  bucketDays: number,
  aggregates: IBalanceHistoryRepoQueryOutput[],
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

export default buildBalanceHistoryHelper;
