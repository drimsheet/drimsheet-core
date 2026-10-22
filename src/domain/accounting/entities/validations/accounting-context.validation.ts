import { TEntityId } from '@shared/types/uuid';

import {
  SYSTEM_ACCOUNTING_STANDARDS,
  UAccountingStandardCode,
} from '@domain/accounting/config/accounting-standards.config';
import {
  SYSTEM_JURISDICTIONS,
  UJurisdictionCode,
} from '@domain/accounting/config/jurisdictions.config';
import accountingEntityValidation from '@domain/accounting/entities/validations/accounting-entity.validation';
import accountingStandardError from '@domain/accounting/errors/accounting-standard.error';
import accountingError from '@domain/accounting/errors/accounting.error';
import jurisdictionError from '@domain/accounting/errors/jurisdiction.error';
import { UAccountingEntityType } from '@domain/accounting/types/accounting-entity.types';
import { IAccountingInterval } from '@domain/accounting/types/accounting-period.types';
import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';

/** ACC-AC-001/002: the interval shares the fiscal year and entity. */
function validateIntervalSelection(
  accountingEntityId: TEntityId,
  fiscalYear: IFiscalYear,
  accountingInterval: IAccountingInterval
) {
  if (fiscalYear.accountingEntityId !== accountingEntityId) {
    throw new accountingError.InvalidFiscalYearId();
  }
  const hasInvalidIntervalOwnership =
    accountingInterval.accountingEntityId !== accountingEntityId ||
    accountingInterval.fiscalYearId !== fiscalYear.id;
  if (hasInvalidIntervalOwnership) {
    throw new accountingError.InvalidAccountingIntervalId();
  }
}

function isValidAccountingStandardCode(
  code: unknown
): code is UAccountingStandardCode {
  return Object.keys(SYSTEM_ACCOUNTING_STANDARDS).includes(
    code as UAccountingStandardCode
  );
}

function validateAccountingStandardCode(code: unknown) {
  if (!isValidAccountingStandardCode(code)) {
    throw new accountingStandardError.Invalid({ code });
  }
}

function validateStandardCode(code: UAccountingStandardCode) {
  if (!code) {
    throw new accountingStandardError.Invalid();
  }

  const standard = SYSTEM_ACCOUNTING_STANDARDS[code];

  if (!standard) {
    throw new accountingStandardError.Invalid();
  }
}

function validateStandardCodeAndJurisdiction(
  code: UAccountingStandardCode,
  jurisdiction: string,
  accountingEntityType: UAccountingEntityType
) {
  accountingEntityValidation.validateType(accountingEntityType);

  const jurisdictionObj =
    SYSTEM_JURISDICTIONS[jurisdiction as UJurisdictionCode];

  if (!jurisdictionObj) {
    throw new jurisdictionError.Invalid();
  }

  const availableStandards =
    jurisdictionObj.accountingStandards[accountingEntityType];

  if (!availableStandards) {
    throw new accountingStandardError.Invalid();
  }

  const isIncluded = availableStandards.includes(code);

  if (!isIncluded) {
    throw new accountingStandardError.Invalid();
  }
}

const accountingContextValidation = Object.freeze({
  validateIntervalSelection,
  isValidAccountingStandardCode,
  validateAccountingStandardCode,
  validateStandardCode,
  validateStandardCodeAndJurisdiction,
});

export default accountingContextValidation;
