import IAppContextService from '@shared/contracts/app-context.service.contract';
import { TEntityId } from '@shared/types/uuid';
import dateUtils from '@shared/utils/date';
import stringUtils from '@shared/utils/string';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

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
import { ICurrency } from '@domain/money/types/currency.types';
import moneyValue from '@domain/money/values/money.vo';

import { IAppContextData } from '@app/context/types/app-context.types';
import IAccountCashFlowQueryRepo, {
  IAccountCashFlowAggregate,
} from '@app/reporting/contracts/account-cash-flow.query.repo.contract';
import {
  IAccountCashFlowDto,
  IGetAccountCashFlowQuery,
} from '@app/reporting/dtos/account-cash-flow/account-cash-flow.dto';
import accountCashFlowMapper from '@app/reporting/dtos/account-cash-flow/account-cash-flow.dto.mapper';
import { getAccountCashFlowQueryValidationSchema } from '@app/reporting/dtos/account-cash-flow/account-cash-flow.dto.validation';
import dateRangeMapper from '@app/reporting/dtos/date/date-range.dto.mapper';
import reportingError from '@app/reporting/errors/reporting.error';
import { IAccountCashFlowReport } from '@app/reporting/types/account-cash-flow.types';
import reportingValidation from '@app/reporting/validations/reporting.validation';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  ledgerAccountRepo: ILedgerAccountRepo;
  accountCashFlowQueryRepo: IAccountCashFlowQueryRepo;
}

export default function makeGetAccountCashFlowUsecase(deps: IDependencies) {
  return async (
    accountId: string,
    query: IGetAccountCashFlowQuery
  ): Promise<IAccountCashFlowDto> => {
    stringUtils.validateUUID(accountId, reportingError.InvalidAccountId);
    zodValidationRunner(getAccountCashFlowQueryValidationSchema, query);

    const period = dateRangeMapper.fromDto(query);
    const days = dateUtils.getUtcCalendarDistance(
      period.from,
      period.to,
      'day'
    );
    reportingValidation.validatePeriodDays(days);

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

    const aggregates = await deps.accountCashFlowQueryRepo.aggregateByAccount(
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
  aggregates: IAccountCashFlowAggregate[],
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

    buckets.push({
      from: dateUtils.addUtcCalendarUnits(from, offset, 'day'),
      to: dateUtils.addUtcCalendarUnits(from, lastDayOffset, 'day'),
      moneyIn: moneyValue.make(aggregate?.moneyIn ?? 0n, currency, true),
      moneyOut: moneyValue.make(aggregate?.moneyOut ?? 0n, currency, true),
    });
  }

  return buckets;
}
