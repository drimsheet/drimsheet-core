import {
  SYSTEM_JURISDICTIONS,
  UJurisdictionCode,
} from '@domain/accounting/config/jurisdictions.config';
import jurisdictionError from '@domain/accounting/errors/jurisdiction.error';

export default function getAccountingJurisdictionHelper(code: string) {
  if (!code) {
    throw new jurisdictionError.Invalid();
  }

  const jurisdiction = SYSTEM_JURISDICTIONS[code as UJurisdictionCode];

  if (!jurisdiction) {
    throw new jurisdictionError.Invalid();
  }

  return jurisdiction;
}
