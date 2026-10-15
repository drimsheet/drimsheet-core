import {
  SYSTEM_JURISDICTIONS,
  UJurisdictionCode,
} from '@domain/accounting/config/jurisdictions.config';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import {
  EAccountingEntityHistoryAction,
  EAccountingEntityType,
  UAccountingEntityHistoryAction,
  UAccountingEntityType,
} from '@domain/accounting/types/accounting-entity.types';

function isValidType(type: UAccountingEntityType) {
  return Object.values(EAccountingEntityType).includes(type);
}

function validateType(type: UAccountingEntityType) {
  if (!isValidType(type)) {
    throw new accountingEntityError.InvalidType({ type });
  }
}

function validateTypeChange(
  before: UAccountingEntityType,
  after: UAccountingEntityType
) {
  validateType(after);
  const isAllowed =
    before === after ||
    (before === EAccountingEntityType.SoleTrader &&
      after === EAccountingEntityType.PrivateCompany);
  if (!isAllowed) {
    throw new accountingEntityError.TypeChangeNotAllowed({ before, after });
  }
}

function isValidJurisdictionCode(code: unknown): code is UJurisdictionCode {
  return Object.keys(SYSTEM_JURISDICTIONS).includes(code as UJurisdictionCode);
}

function validateJurisdictionCode(code: unknown) {
  if (!isValidJurisdictionCode(code)) {
    throw new accountingEntityError.InvalidJurisdictionCode({ code });
  }
}

function isValidHistoryAction(action: UAccountingEntityHistoryAction) {
  return Object.values(EAccountingEntityHistoryAction).includes(action);
}

function validateHistoryAction(action: UAccountingEntityHistoryAction) {
  if (!isValidHistoryAction(action)) {
    throw new accountingEntityError.InvalidHistoryAction({ action });
  }
}

const accountingEntityValidation = Object.freeze({
  isValidType,
  validateType,
  validateTypeChange,

  isValidJurisdictionCode,
  validateJurisdictionCode,

  isValidHistoryAction,
  validateHistoryAction,
});

export default accountingEntityValidation;
