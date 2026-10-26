/**
 * SUMMARY
 * Totals journal-line debits and credits by original currency for one ledger
 * class within a required fiscal year. Optional inclusive dates default to the
 * fiscal year start and min(today UTC, year end). Rejects ranges outside the
 * year or reversed ranges. Excludes draft and voided entries only.
 *
 * WHEN TO USE
 * Use for fiscal-year or narrower-period asset, liability, revenue and expense
 * debit and credit totals. Equity accounts are not supported.
 *
 * SEQUENCE DIAGRAM
 * Not required for this read-only reporting workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import { IDateRange } from '@shared/types/date.types';
import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import dateUtils from '@shared/utils/date';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import IFiscalYearRepo from '@domain/accounting/repos/fiscal-year.repo';
import getLedgerAccountNormalBalance from '@domain/ledger/entities/helpers/get-normal-balance.helper';
import { UNormalBalance } from '@domain/ledger/types/ledger.types';
import currencyEntity from '@domain/money/entities/currency.entity';
import moneyValue from '@domain/money/values/money.vo';

import accountingAppError from '@app/accounting/errors/accounting.error';
import { IAppContextData } from '@app/context/types/app-context.types';
import reportingError from '@app/ledger/errors/reporting.error';
import { dateRangeMapper } from '@app/ledger/usecases/reporting/shared/date-range';
import reportingValidation from '@app/ledger/usecases/reporting/shared/reporting.validation';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';

import {
  getLedgerTotalDebitsAndCreditsByCurrencyQueryValidationSchema,
  IGetLedgerTotalDebitsAndCreditsByCurrencyQuery,
  ILedgerTotalDebitsAndCreditsByCurrencyDto,
} from './dto';

/** Reads exact original-currency totals in one query; excludes draft/voided only. */
export type TGetLedgerTotalDebitsAndCreditsByCurrencyRepoQuery = (
  input: {
    accountingEntityId: TEntityId;
    type: IGetLedgerTotalDebitsAndCreditsByCurrencyQuery['type'];
    period: IDateRange;
  },
  options: IReadRepoOptions
) => Promise<{ currencyCode: string; debits: bigint; credits: bigint }[]>;

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  fiscalYearRepo: IFiscalYearRepo;
  repoQuery: TGetLedgerTotalDebitsAndCreditsByCurrencyRepoQuery;
}

export default function makeGetLedgerTotalDebitsAndCreditsByCurrencyUsecase(
  deps: IDependencies
) {
  return async (
    query: IGetLedgerTotalDebitsAndCreditsByCurrencyQuery
  ): Promise<ILedgerTotalDebitsAndCreditsByCurrencyDto> => {
    zodValidationRunner(
      getLedgerTotalDebitsAndCreditsByCurrencyQueryValidationSchema,
      query
    );

    const { accountingEntity, correlationId } = deps.appContext.get([
      'accountingEntity',
    ]);
    const fiscalYear = await deps.fiscalYearRepo.findById(
      accountingEntity.id,
      query.fiscalYearId as TEntityId,
      { correlationId }
    );
    if (!fiscalYear) {
      throw new accountingAppError.FiscalYearNotFound();
    }

    const today = dateUtils.toUtcStartOfDay(dateUtils.now());
    const defaultEnd = dateUtils.isLessThan(today, fiscalYear.endDate)
      ? today
      : fiscalYear.endDate;
    const period: IDateRange = {
      from:
        query.startDate === undefined
          ? fiscalYear.startDate
          : new Date(query.startDate),
      to: query.endDate === undefined ? defaultEnd : new Date(query.endDate),
    };
    const isInvalidPeriod =
      !dateUtils.isWithinRange(
        period.from,
        fiscalYear.startDate,
        fiscalYear.endDate
      ) ||
      !dateUtils.isWithinRange(
        period.to,
        fiscalYear.startDate,
        fiscalYear.endDate
      ) ||
      dateUtils.isGreaterThan(period.from, period.to);
    if (isInvalidPeriod) {
      throw new reportingError.InvalidPeriod();
    }

    const totals = await deps.repoQuery(
      { accountingEntityId: accountingEntity.id, type: query.type, period },
      { correlationId }
    );

    const normalBalance = getLedgerAccountNormalBalance(query.type);
    totals.sort((left, right) =>
      left.currencyCode.localeCompare(right.currencyCode)
    );

    return {
      fiscalYearId: fiscalYear.id,
      period: dateRangeMapper.toDto(period),
      totalsByCurrency: totals.map((total) =>
        buildCurrencyTotals(total, normalBalance)
      ),
    };
  };
}

/** Checks exact totals before converting them to the numeric minor-unit DTO. */
function buildCurrencyTotals(
  total: { currencyCode: string; debits: bigint; credits: bigint },
  normalBalance: UNormalBalance
) {
  const currency = currencyEntity.getByCode(total.currencyCode);
  const debits = moneyValue.make(total.debits, currency, true);
  const credits = moneyValue.make(total.credits, currency, true);
  const hasNegativeTotal = total.debits < 0n || total.credits < 0n;
  if (hasNegativeTotal) {
    throw new reportingError.AmountOutOfRange();
  }
  for (const amount of [debits, credits]) {
    reportingValidation.validateAmountLimit(amount);
    reportingValidation.validateSafeAmount(amount);
  }
  const delta =
    normalBalance === 'debit'
      ? moneyValue.subtract(debits, credits)
      : moneyValue.subtract(credits, debits);

  return {
    totalDebits: moneyMapper.toDto(debits),
    totalCredits: moneyMapper.toDto(credits),
    delta: moneyMapper.toDto(delta),
  };
}
