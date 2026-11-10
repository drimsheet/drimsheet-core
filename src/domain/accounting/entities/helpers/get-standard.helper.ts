import {
  SYSTEM_ACCOUNTING_STANDARDS,
  UAccountingStandardCode,
} from '@domain/accounting/config/accounting-standards.config';
import accountingStandardError from '@domain/accounting/errors/accounting-standard.error';

export default function getAccountingStandardHelper(
  code: UAccountingStandardCode
) {
  const standard = SYSTEM_ACCOUNTING_STANDARDS[code];

  if (!standard) {
    throw new accountingStandardError.Invalid();
  }

  return standard;
}
