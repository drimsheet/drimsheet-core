import { TCreationOmits } from '@shared/types/creation-omits.types';
import dateUtils from '@shared/utils/date';
import deepFreeze from '@shared/utils/deep-freeze';
import generateDiff from '@shared/utils/diff-generator';
import stringUtils from '@shared/utils/string';
import generateUUID from '@shared/utils/uuid-generator';
import {
  IEvent,
  TAuditedEntity,
} from '@shared/values/events/types/event.types';

import ledgerAccountValidation from '@domain/ledger/entities/validations/ledger-account.validation';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ledgerAccountEvents from '@domain/ledger/events/ledger-account.events';
import {
  ELedgerAccountAuditAction,
  ILedgerAccountAudit,
} from '@domain/ledger/types/ledger-account-audit.types';
import {
  ELedgerAccountStatus,
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';
import ledgerAccountAudit from '@domain/ledger/values/ledger-account-audit.vo';
import currencyEntity from '@domain/money/entities/currency.entity';

function make<T extends ILedgerAccount>(
  payload: TCreationOmits<T, 'openingBalanceDate'> & {
    openingBalanceDate?: Date | null;
  }
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

  const openingBalanceDate = payload.openingBalanceDate ?? null;
  if (openingBalanceDate !== null) {
    dateUtils.validateDateIsNotInTheFuture(
      openingBalanceDate,
      ledgerAccountError.InvalidOpeningBalanceDate
    );
    if (payload.isControlAccount)
      throw new ledgerAccountError.ForbiddenControlAccountOpeningBalanceDate();
  }

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
    openingBalanceDate:
      openingBalanceDate === null ? null : new Date(openingBalanceDate),
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

/** Applies editable account details while retaining accounting identity. */
function update<T extends ILedgerAccount>(
  account: T,
  details: Partial<Pick<T, 'name' | 'openingBalanceDate' | 'meta'>>
): [Readonly<T>, IEvent<ILedgerAccount>[], ILedgerAccountAudit | null] {
  const name =
    details.name === undefined
      ? account.name
      : stringUtils.sanitizeAndValidate(
          details.name,
          { min: 2, max: 100 },
          ledgerAccountError.InvalidName
        );
  const openingBalanceDate =
    details.openingBalanceDate === undefined
      ? account.openingBalanceDate
      : details.openingBalanceDate;

  if (openingBalanceDate !== null) {
    dateUtils.validateDateIsNotInTheFuture(
      openingBalanceDate,
      ledgerAccountError.InvalidOpeningBalanceDate
    );
    if (account.isControlAccount) {
      throw new ledgerAccountError.ForbiddenControlAccountOpeningBalanceDate();
    }
  }

  const hasOpeningBalanceDateChanged =
    account.openingBalanceDate?.getTime() !== openingBalanceDate?.getTime();
  const meta = details.meta === undefined ? account.meta : details.meta;
  ledgerAccountValidation.validateMeta(meta);
  const hasMetaChanged = generateDiff(
    { meta },
    { meta: account.meta }
  ).hasChanges;
  const isUnchanged =
    name === account.name && !hasOpeningBalanceDateChanged && !hasMetaChanged;
  if (isUnchanged) {
    return [account, [], null];
  }

  const updatedAccount = deepFreeze({
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
    name,
    currency: account.currency,
    status: account.status,
    contraAccountRule: account.contraAccountRule,
    adjunctAccountRule: account.adjunctAccountRule,
    meta,
    createdBy: account.createdBy,
    createdAt: account.createdAt,
    deletedAt: account.deletedAt,
    openingBalanceDate:
      openingBalanceDate === null ? null : new Date(openingBalanceDate),
    version: account.version + 1,
    updatedAt: new Date(),
  }) as Readonly<T>;
  const audit = ledgerAccountAudit.make({
    before: account,
    after: updatedAccount,
    action: ELedgerAccountAuditAction.Updated,
  });

  return [updatedAccount, [ledgerAccountEvents.updated(updatedAccount)], audit];
}

/** Archives lifecycle state without changing identity or accounting references. */
function archive(
  account: ILedgerAccount
): [ILedgerAccount, IEvent<ILedgerAccount>[], ILedgerAccountAudit | null] {
  ledgerAccountValidation.validateStatus(account.status);
  if (account.status === ELedgerAccountStatus.Archived) {
    return [account, [], null];
  }

  const archivedAccount: ILedgerAccount = deepFreeze({
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
    status: ELedgerAccountStatus.Archived,
    contraAccountRule: account.contraAccountRule,
    adjunctAccountRule: account.adjunctAccountRule,
    meta: account.meta,
    openingBalanceDate: account.openingBalanceDate,
    version: account.version + 1,
    createdBy: account.createdBy,
    createdAt: account.createdAt,
    updatedAt: new Date(),
    deletedAt: account.deletedAt,
  });
  const audit = ledgerAccountAudit.make({
    before: account,
    after: archivedAccount,
    action: ELedgerAccountAuditAction.Archived,
  });
  return [
    archivedAccount,
    [ledgerAccountEvents.archived(archivedAccount)],
    audit,
  ];
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

const ledgerAccountEntity = Object.freeze({
  make,
  update,
  archive,
  updateOpeningBalanceDate,
  getMaterializedPaths,
  ...ledgerAccountValidation,
});

export default ledgerAccountEntity;
