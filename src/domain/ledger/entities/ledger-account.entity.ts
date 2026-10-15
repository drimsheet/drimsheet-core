import { TCreationOmits } from '@shared/types/creation-omits.types';
import { TEntityId } from '@shared/types/uuid';
import dateUtils from '@shared/utils/date';
import deepFreeze from '@shared/utils/deep-freeze';
import generateDiff from '@shared/utils/diff-generator';
import stringUtils from '@shared/utils/string';
import generateUUID from '@shared/utils/uuid-generator';
import {
  IEvent,
  TAuditedEntity,
} from '@shared/values/events/types/event.types';

import getLedgerAccountMaterializedPath from '@domain/ledger/entities/helpers/get-materialized-path.helper';
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
    if (payload.isControlAccount) {
      throw new ledgerAccountError.ForbiddenControlAccountOpeningBalanceDate();
    }
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
  details: Partial<Pick<T, 'name' | 'openingBalanceDate' | 'meta' | 'currency'>>
): [Readonly<T>, IEvent<ILedgerAccount>[], ILedgerAccountAudit | null] {
  const currency = details.currency ?? account.currency;
  if (currency) {
    currencyEntity.validateCode(currency.code);
  }

  const name =
    details.name !== undefined
      ? stringUtils.sanitizeAndValidate(
          details.name,
          { min: 2, max: 100 },
          ledgerAccountError.InvalidName
        )
      : account.name;

  const openingBalanceDate =
    details?.openingBalanceDate ?? account.openingBalanceDate;

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

  const meta = details?.meta ?? account.meta;

  ledgerAccountValidation.validateMeta(meta);

  const hasMetaChanged = generateDiff(
    { meta },
    { meta: account.meta }
  ).hasChanges;

  const isUnchanged =
    currency?.code === account.currency?.code &&
    name === account.name &&
    !hasOpeningBalanceDateChanged &&
    !hasMetaChanged;

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
    currency,
    status: account.status,
    contraAccountRule: account.contraAccountRule,
    adjunctAccountRule: account.adjunctAccountRule,
    meta,
    createdBy: account.createdBy,
    createdAt: account.createdAt,
    deletedAt: account.deletedAt,
    openingBalanceDate,
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

/** Reparents a posting account while preserving journal identity and financial meaning. */
function reparentPostingAccount(
  account: ILedgerAccount,
  controlAccount: ILedgerAccount,
  code: string,
  newPostingAccountName?: string
): TAuditedEntity<ILedgerAccount, ILedgerAccount, ILedgerAccount> {
  ledgerAccountValidation.validatePostingAccountReparenting(
    account,
    controlAccount
  );

  ledgerAccountValidation.validateCode(code);

  const materializedPath = getLedgerAccountMaterializedPath(
    controlAccount.materializedPath,
    code
  );
  ledgerAccountValidation.validateMaterializedPath(materializedPath);

  const name = stringUtils.sanitizeAndValidate(
    newPostingAccountName ?? account.name,
    { min: 2, max: 100 },
    ledgerAccountError.InvalidName
  );

  const updatedAccount: ILedgerAccount = deepFreeze({
    id: account.id,
    code,
    materializedPath,
    accountingEntityId: account.accountingEntityId,
    type: account.type,
    normalBalance: account.normalBalance,
    subType: account.subType,
    behavior: account.behavior,
    isControlAccount: false,
    controlAccountId: controlAccount.id,
    name,
    currency: account.currency,
    status: account.status,
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
    after: updatedAccount,
    action: ELedgerAccountAuditAction.Updated,
  });

  return [updatedAccount, [ledgerAccountEvents.updated(updatedAccount)], audit];
}

/** Creates the grouping account at the posting account's original position. */
function clonePostingAccountToControlAccount(
  account: ILedgerAccount,
  createdBy: TEntityId,
  newControlAccountName?: string
) {
  return make({
    code: account.code,
    materializedPath: account.materializedPath,
    accountingEntityId: account.accountingEntityId,
    type: account.type,
    normalBalance: account.normalBalance,
    subType: account.subType,
    behavior: account.behavior,
    isControlAccount: true,
    controlAccountId: account.controlAccountId,
    name: newControlAccountName ?? account.name,
    currency: account.currency,
    status: account.status,
    contraAccountRule: account.contraAccountRule,
    adjunctAccountRule: account.adjunctAccountRule,
    meta: null,
    openingBalanceDate: null,
    createdBy,
  });
}

/** Activates a draft account while preserving its identity and accounting references. */
function activate(
  account: ILedgerAccount
): TAuditedEntity<ILedgerAccount, ILedgerAccount, ILedgerAccount> {
  if (account.status !== ELedgerAccountStatus.Draft) {
    throw new ledgerAccountError.InvalidStatus({ status: account.status });
  }

  const activatedAccount: ILedgerAccount = deepFreeze({
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
    status: ELedgerAccountStatus.Active,
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
    after: activatedAccount,
    action: ELedgerAccountAuditAction.Updated,
  });

  return [
    activatedAccount,
    [ledgerAccountEvents.updated(activatedAccount)],
    audit,
  ];
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

/** Allocates within one ledger family, including any code reserved by a prepared promotion. */
function getNextCode<T extends string>(
  allocationCode: T,
  latestCode?: string,
  reservedCode?: string
): T {
  ledgerAccountValidation.validateCode(allocationCode);
  const familyPrefix = allocationCode.slice(0, 3);
  const latestAllocatedCode = latestCode ?? allocationCode;
  ledgerAccountValidation.validatePredecessorCode(
    familyPrefix,
    latestAllocatedCode
  );
  if (reservedCode !== undefined) {
    ledgerAccountValidation.validatePredecessorCode(familyPrefix, reservedCode);
  }

  const hasLaterReservation =
    reservedCode !== undefined &&
    Number(reservedCode) > Number(latestAllocatedCode);
  const predecessorCode = hasLaterReservation
    ? reservedCode
    : latestAllocatedCode;
  const suffix = predecessorCode.substring(3);
  if (suffix === '999') {
    throw new ledgerAccountError.MaximumLimitReached({ predecessorCode });
  }

  const nextSuffix = (Number(suffix) + 1).toString().padStart(3, '0');

  return `${familyPrefix}${nextSuffix}` as T;
}

/** Suspense families use their initial code for the first account, then advance normally. */
function getSuspenseCode<T extends string>(
  initialCode: T,
  latestCode?: string
): T {
  ledgerAccountValidation.validateCode(initialCode);
  return latestCode === undefined
    ? initialCode
    : getNextCode(initialCode, latestCode);
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
  clonePostingAccountToControlAccount,
  reparentPostingAccount,
  update,
  archive,
  activate,
  updateOpeningBalanceDate,
  getMaterializedPaths,
  getNextCode,
  getSuspenseCode,
  ...ledgerAccountValidation,
});

export default ledgerAccountEntity;
