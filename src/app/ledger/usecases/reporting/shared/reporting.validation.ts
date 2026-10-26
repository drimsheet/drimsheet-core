import { IMoney } from '@domain/money/types/money.types';
import moneyValue from '@domain/money/values/money.vo';

import reportingError from '@app/ledger/errors/reporting.error';

const MAX_PERIOD_DAYS = 366;
const MAX_MAJOR_UNITS = 1_000_000_000_000n;

/** Validates the inclusive day count computed from validated calendar dates. */
function validatePeriodDays(days: number): void {
  if (days <= 0) {
    throw new reportingError.InvalidPeriod();
  }
  if (days > MAX_PERIOD_DAYS) {
    throw new reportingError.ReportPeriodLimitExceeded({
      maxDays: MAX_PERIOD_DAYS,
    });
  }
}

/** Checks the magnitude in the amount's currency; sign rules belong to each report. */
function validateAmountLimit(money: IMoney): void {
  const absoluteAmount = money.amount < 0n ? -money.amount : money.amount;
  const cap = MAX_MAJOR_UNITS * 10n ** BigInt(money.currency.minorUnit);
  if (absoluteAmount > cap) {
    throw new reportingError.ReportAmountLimitExceeded({
      currencyCode: money.currency.code,
      maxMajorUnits: MAX_MAJOR_UNITS.toString(),
    });
  }
}

/** Rejects minor units that cannot be serialized exactly as a number. */
function validateSafeAmount(money: IMoney): void {
  if (!moneyValue.isSafeMinorUnitNumber(money)) {
    throw new reportingError.AmountOutOfRange();
  }
}

export default Object.freeze({
  validatePeriodDays,
  validateAmountLimit,
  validateSafeAmount,
});
