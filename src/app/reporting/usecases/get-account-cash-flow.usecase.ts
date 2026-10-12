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
import moneyValue from '@domain/money/values/money.vo';

import IAppContext from '@app/context/contracts/app-context.contract';
import IAccountCashFlowQueryRepo from '@app/reporting/contracts/account-cash-flow.query.repo.contract';
import {
  IAccountCashFlowDto,
  IGetAccountCashFlowQuery,
} from '@app/reporting/dtos/account-cash-flow/account-cash-flow.dto';
import accountCashFlowMapper from '@app/reporting/dtos/account-cash-flow/account-cash-flow.dto.mapper';
import { getAccountCashFlowQueryValidationSchema } from '@app/reporting/dtos/account-cash-flow/account-cash-flow.dto.validation';
import reportingError from '@app/reporting/errors/reporting.error';
import buildAccountCashFlowBucketsHelper from '@app/reporting/usecases/helpers/build-account-cash-flow-buckets.helper';

const MAX_PERIOD_DAYS = 366;
const MAX_MAJOR_UNITS = 1_000_000_000_000n;

interface IDependencies {
  appContext: IAppContext;
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

    const days = dateUtils.getUtcCalendarDistance(
      new Date(query.from),
      new Date(query.to),
      'day'
    );
    if (days <= 0) throw new reportingError.InvalidPeriod();
    if (days > MAX_PERIOD_DAYS) {
      throw new reportingError.ReportPeriodLimitExceeded({
        maxDays: MAX_PERIOD_DAYS,
      });
    }

    const { correlationId, accountingEntity } = deps.appContext.get([
      'accountingEntity',
    ]);

    const repoOptions = { correlationId };

    const account = await deps.ledgerAccountRepo.findById(
      accountId as TEntityId,
      accountingEntity.id,
      repoOptions
    );
    if (!account) throw new reportingError.AccountNotFound();

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

    if (!isEligible) throw new reportingError.UnsupportedAccount();

    const { currency } = account;
    if (!currency) throw new reportingError.UnsupportedAccount();

    const aggregates = await deps.accountCashFlowQueryRepo.aggregateByAccount(
      {
        accountId: accountId as TEntityId,
        accountingEntityId: accountingEntity.id,
        currencyCode: currency.code,
        from: query.from,
        to: query.to,
        bucketDays: query.bucketDays,
      },
      repoOptions
    );

    const buckets = buildAccountCashFlowBucketsHelper(
      query.from,
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
    const maxMinorUnits = MAX_MAJOR_UNITS * 10n ** BigInt(currency.minorUnit);
    const exceedsProductLimit =
      totalMoneyIn.amount > maxMinorUnits ||
      totalMoneyOut.amount > maxMinorUnits;

    if (exceedsProductLimit) {
      throw new reportingError.ReportAmountLimitExceeded({
        currencyCode: currency.code,
        maxMajorUnits: MAX_MAJOR_UNITS.toString(),
      });
    }

    const cashFlowAmounts = [
      totalMoneyIn,
      totalMoneyOut,
      ...buckets.flatMap((bucket) => [bucket.moneyIn, bucket.moneyOut]),
    ];
    for (const money of cashFlowAmounts) {
      const isOutOfRange =
        money.amount < 0n || !moneyValue.isSafeMinorUnitNumber(money);
      if (isOutOfRange) throw new reportingError.AmountOutOfRange();
    }

    const report = {
      period: { from: query.from, to: query.to },
      totalMoneyIn,
      totalMoneyOut,
      buckets,
    };
    return accountCashFlowMapper.toDto(accountId, report);
  };
}
