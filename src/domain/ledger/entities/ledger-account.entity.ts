import { TCreationOmits } from '@shared/types/creation-omits.types';
import dateUtils from '@shared/utils/date';
import deepFreeze from '@shared/utils/deep-freeze';
import stringUtils from '@shared/utils/string';
import generateUUID from '@shared/utils/uuid-generator';
import { TAuditedEntity } from '@shared/values/events/types/event.types';

import getNextSubledgerAccountCode from '@domain/ledger/entities/helpers/get-subledger-code.helper';
import ledgerAccountValidation from '@domain/ledger/entities/validations/ledger-account.validation';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ledgerAccountEvents from '@domain/ledger/events/ledger-account.events';
import { ELedgerAccountAuditAction } from '@domain/ledger/types/ledger-account-audit.types';
import {
  ILedgerAccount,
  TAuditedLedgerAccount,
} from '@domain/ledger/types/ledger.types';
import ledgerAccountAudit from '@domain/ledger/values/ledger-account-audit.vo';
import currencyEntity from '@domain/money/entities/currency.entity';

function make<T extends ILedgerAccount>(
  payload: TCreationOmits<T, 'openingBalanceDate'>
): TAuditedEntity<Readonly<T>, T, ILedgerAccount> {
  ledgerAccountValidation.validateCode(payload.code);
  stringUtils.validateUUID(
    payload.accountingEntityId,
    ledgerAccountError.InvalidAccountingEntityId
  );
  ledgerAccountValidation.validateType(payload.type);

  if (payload.controlAccountId) {
    stringUtils.validateUUID(
      payload.controlAccountId,
      ledgerAccountError.InvalidControlAccountId
    );
  }

  if (payload.currency) {
    currencyEntity.validateCode(payload.currency.code);
  }
  ledgerAccountValidation.validateStatus(payload.status);

  ledgerAccountValidation.validateContraRule(payload.contraAccountRule);
  ledgerAccountValidation.validateAdjunctRule(payload.adjunctAccountRule);
  stringUtils.validateUUID(
    payload.createdBy,
    ledgerAccountError.InvalidCreatedBy
  );

  ledgerAccountValidation.validateSubType(payload.subType);
  ledgerAccountValidation.validateBehavior(payload.behavior);
  ledgerAccountValidation.validateNormalBalance(payload.normalBalance);

  ledgerAccountValidation.validateIsControlAccount(payload.isControlAccount);
  ledgerAccountValidation.validateMeta(payload.meta);
  ledgerAccountValidation.validateMaterializedPath(payload.materializedPath);

  const timestamp = new Date();

  const ledgerAccount: ILedgerAccount = {
    id: generateUUID(),
    code: payload.code,
    accountingEntityId: payload.accountingEntityId,
    type: payload.type,
    materializedPath: payload.materializedPath,
    normalBalance: payload.normalBalance,
    subType: payload.subType,
    behavior: payload.behavior,
    isControlAccount: !!payload.isControlAccount,
    controlAccountId: payload.controlAccountId,
    name: stringUtils.sanitizeAndValidate(
      payload.name,
      { min: 2, max: 100 },
      ledgerAccountError.InvalidName
    ),
    currency: payload.currency,
    status: payload.status,
    contraAccountRule: payload.contraAccountRule,
    adjunctAccountRule: payload.adjunctAccountRule,
    // Proper meta validation is delegated to the specific ledger account entity
    meta: payload.meta,
    openingBalanceDate: null,
    version: 1,
    createdBy: payload.createdBy,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };

  const entity = Object.freeze(ledgerAccount) as Readonly<T>;

  const event = ledgerAccountEvents.makeCreated(entity);

  const audit = ledgerAccountAudit.make({
    before: null,
    after: ledgerAccount,
    action: ELedgerAccountAuditAction.Created,
  });

  return [entity, [event], audit];
}

function updateOpeningBalanceDate<T extends ILedgerAccount>(
  account: T,
  openingBalanceDate: Date
): TAuditedEntity<Readonly<T>, T, ILedgerAccount> {
  dateUtils.validateDateIsNotInTheFuture(
    openingBalanceDate,
    ledgerAccountError.InvalidOpeningBalanceDate
  );

  if (account.isControlAccount) {
    throw new ledgerAccountError.ForbiddenControlAccountOpeningBalanceDate();
  }

  if (account.openingBalanceDate !== null) {
    throw new ledgerAccountError.OpeningBalanceDateAlreadySet();
  }

  const timestamp = new Date();

  const updatedAccount: T = {
    id: account.id,
    code: account.code,
    materializedPath: account.materializedPath,
    accountingEntityId: account.accountingEntityId,
    type: account.type,
    normalBalance: account.normalBalance,
    subType: account.subType,
    behavior: account.behavior,
    isControlAccount: account.isControlAccount,
    controlAccountId: account.controlAccountId,
    name: account.name,
    currency: account.currency,
    status: account.status,
    contraAccountRule: account.contraAccountRule,
    adjunctAccountRule: account.adjunctAccountRule,
    meta: account.meta,
    openingBalanceDate,
    version: account.version + 1,
    createdBy: account.createdBy,
    createdAt: account.createdAt,
    updatedAt: timestamp,
    deletedAt: account.deletedAt,
  } as T;

  const entity = Object.freeze(updatedAccount);

  const event = ledgerAccountEvents.updated(entity);

  const audit = ledgerAccountAudit.make({
    before: account,
    after: updatedAccount,
    action: ELedgerAccountAuditAction.Updated,
  });

  return [entity, [event], audit];
}

/** Returns each account path and all of its ancestor paths without duplicates. */
function getMaterializedPaths(
  accounts: Pick<ILedgerAccount, 'materializedPath'>[]
) {
  const accountPaths = accounts.flatMap((account) => {
    const segments = account.materializedPath.split('.');

    return segments.map((_, index) => segments.slice(0, index + 1).join('.'));
  });

  return [...new Set(accountPaths)];
}

/** Updates the account code and the final segment of its materialized path. */
function updateCode(
  account: ILedgerAccount,
  newCode: string
): TAuditedLedgerAccount {
  ledgerAccountValidation.validateCode(newCode);

  const materializedPath = account.materializedPath
    .split('.')
    .slice(0, -1)
    .concat(newCode)
    .join('.');
  ledgerAccountValidation.validateMaterializedPath(materializedPath);

  const updatedAccount: ILedgerAccount = {
    id: account.id,
    code: newCode,
    materializedPath,
    accountingEntityId: account.accountingEntityId,
    type: account.type,
    normalBalance: account.normalBalance,
    subType: account.subType,
    behavior: account.behavior,
    isControlAccount: account.isControlAccount,
    controlAccountId: account.controlAccountId,
    name: account.name,
    currency: structuredClone(account.currency),
    status: account.status,
    contraAccountRule: account.contraAccountRule,
    adjunctAccountRule: account.adjunctAccountRule,
    meta: structuredClone(account.meta),
    openingBalanceDate: structuredClone(account.openingBalanceDate),
    version: account.version + 1,
    createdBy: account.createdBy,
    createdAt: structuredClone(account.createdAt),
    updatedAt: new Date(),
    deletedAt: structuredClone(account.deletedAt),
  };
  const entity = deepFreeze(updatedAccount);
  const event = ledgerAccountEvents.updated(entity);
  const audit = ledgerAccountAudit.make({
    before: account,
    after: entity,
    action: ELedgerAccountAuditAction.Updated,
  });

  return [entity, [event], audit];
}

/** Allocates the next code in the account's code family and applies the update. */
function assignNextCode(
  account: ILedgerAccount,
  latestAccount: Pick<ILedgerAccount, 'code'>
): TAuditedLedgerAccount {
  const nextCode = getNextSubledgerAccountCode(
    account.code.slice(0, 3),
    latestAccount.code
  );
  return updateCode(account, nextCode);
}

const ledgerAccountEntity = Object.freeze({
  make,
  updateOpeningBalanceDate,
  updateCode,
  assignNextCode,
  getMaterializedPaths,
  ...ledgerAccountValidation,
});

export default ledgerAccountEntity;
