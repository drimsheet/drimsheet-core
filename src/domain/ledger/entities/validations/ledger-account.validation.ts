import stringUtils from '@shared/utils/string';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerAccountStatus,
  ELedgerType,
  ENormalBalance,
  ILedgerAccount,
  UAdjunctAccountRule,
  UContraAccountRule,
  ULedgerAccountStatus,
  ULedgerType,
  UNormalBalance,
} from '@domain/ledger/types/ledger.types';

function validateCode(code: string) {
  if (!/^[1-5][0-9]{5}$/.test(code)) {
    throw new ledgerAccountError.InvalidCode({ code });
  }
}

function validatePredecessorCode(
  familyPrefix: string,
  predecessorCode: string
) {
  const isInvalidPredecessorCode =
    !/^[1-5][0-9]{5}$/.test(predecessorCode) ||
    !predecessorCode.startsWith(familyPrefix);
  if (isInvalidPredecessorCode) {
    throw new ledgerAccountError.InvalidPredecessorCode({ predecessorCode });
  }
}

/** Requires a posting source and a control parent with the same financial classification and currency. */
function validatePostingAccountReparenting(
  account: ILedgerAccount,
  controlAccount: ILedgerAccount
) {
  const isInvalidPromotion =
    account.isControlAccount ||
    !controlAccount.isControlAccount ||
    account.accountingEntityId !== controlAccount.accountingEntityId ||
    account.type !== controlAccount.type ||
    account.subType !== controlAccount.subType ||
    account.behavior !== controlAccount.behavior ||
    account.normalBalance !== controlAccount.normalBalance ||
    account.currency?.code !== controlAccount.currency?.code;

  if (isInvalidPromotion) {
    throw new ledgerAccountError.InvalidControlAccount();
  }
}

function validateType(type: ULedgerType) {
  if (!Object.values(ELedgerType).includes(type)) {
    throw new ledgerAccountError.InvalidType({ type });
  }
}

function validateStatus(status: ULedgerAccountStatus) {
  if (!Object.values(ELedgerAccountStatus).includes(status)) {
    throw new ledgerAccountError.InvalidStatus({ status });
  }
}

function validateContraRule(rule: UContraAccountRule) {
  if (!Object.values(EContraAccountRule).includes(rule)) {
    throw new ledgerAccountError.InvalidContraRule({ rule });
  }
}

function validateAdjunctRule(rule: UAdjunctAccountRule) {
  if (!Object.values(EAdjunctAccountRule).includes(rule)) {
    throw new ledgerAccountError.InvalidAdjunctRule({ rule });
  }
}

function validateNormalBalance(normalBalance: UNormalBalance) {
  if (!Object.values(ENormalBalance).includes(normalBalance)) {
    throw new ledgerAccountError.InvalidNormalBalance({ normalBalance });
  }
}

function validateSubType(subType: string) {
  if (!stringUtils.isNonEmptyString(subType)) {
    throw new ledgerAccountError.InvalidSubType({ subType });
  }
}

function validateBehavior(behavior: string) {
  if (!stringUtils.isNonEmptyString(behavior)) {
    throw new ledgerAccountError.InvalidBehavior({ behavior });
  }
}

function validateIsControlAccount(isControlAccount: boolean) {
  if (typeof isControlAccount !== 'boolean') {
    throw new ledgerAccountError.InvalidControlAccountStatus({
      isControlAccount,
    });
  }
}

function validateMeta(meta: unknown) {
  if (meta !== null && typeof meta !== 'object') {
    throw new ledgerAccountError.InvalidMeta({ meta });
  }
}

function validateMaterializedPath(materializedPath: string) {
  // We only permit 10 levels of ledger accounts
  const isValid = stringUtils.isStringWithinRange(materializedPath, {
    min: 6,
    max: 69,
    sanitize: false,
  });

  if (!isValid) {
    throw new ledgerAccountError.InvalidMaterializedPath({
      materializedPath,
    });
  }
}

const ledgerAccountValidation = Object.freeze({
  validateCode,
  validatePredecessorCode,
  validatePostingAccountReparenting,
  validateType,
  validateStatus,
  validateContraRule,
  validateAdjunctRule,
  validateNormalBalance,
  validateSubType,
  validateBehavior,
  validateIsControlAccount,
  validateMeta,
  validateMaterializedPath,
});

export default ledgerAccountValidation;
