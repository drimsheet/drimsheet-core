import { ASSET_LEDGER_CODES } from '@domain/ledger/config/asset-codes.config';
import { LIABILITY_LEDGER_CODES } from '@domain/ledger/config/liability-codes.config';
import getLedgerAccountNormalBalance from '@domain/ledger/entities/helpers/get-normal-balance.helper';
import getNextSubledgerAccountCode from '@domain/ledger/entities/helpers/get-subledger-code.helper';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import {
  EAssetAccountBehavior,
  EAssetSubType,
} from '@domain/ledger/types/asset-account.types';
import {
  TAssetSuspenseLedgerCode,
  TLiabilitySuspenseLedgerCode,
} from '@domain/ledger/types/ledger-code.types';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerAccountStatus,
  ELedgerType,
} from '@domain/ledger/types/ledger.types';
import {
  ELiabilityAccountBehavior,
  ELiabilitySubType,
} from '@domain/ledger/types/liability-account.types';
import { ISuspenseAccountService } from '@domain/ledger/types/suspense-account.service.types';

interface IDependencies {
  ledgerAccountRepo: ILedgerAccountRepo;
}

/** Prepares a unique asset suspense account; callers serialize allocation through commit. */
function makeCreateAssetSuspense(
  deps: IDependencies
): ISuspenseAccountService['createAssetSuspense'] {
  return async (payload, repoOptions) => {
    const accounts = await deps.ledgerAccountRepo.findBySubType(
      payload.accountingEntityId,
      ELedgerType.Asset,
      EAssetSubType.Suspense,
      repoOptions
    );
    const duplicate = accounts.find(
      (account) => account.currency?.code === payload.currency.code
    );
    if (duplicate) {
      throw new ledgerAccountError.SuspenseAccountAlreadyExists({
        accountingEntityId: payload.accountingEntityId,
        type: ELedgerType.Asset,
        currencyCode: payload.currency.code,
        accountId: duplicate.id,
      });
    }

    const latest = await deps.ledgerAccountRepo.findLatestBySubType(
      payload.accountingEntityId,
      ELedgerType.Asset,
      EAssetSubType.Suspense,
      repoOptions
    );

    const code = !latest
      ? ASSET_LEDGER_CODES.SUSPENSE_ACCOUNT.INITIAL
      : getNextSubledgerAccountCode(
          ASSET_LEDGER_CODES.SUSPENSE_ACCOUNT.PREFIX,
          latest.code as TAssetSuspenseLedgerCode
        );

    return ledgerAccountEntity.make({
      name: payload.name,
      accountingEntityId: payload.accountingEntityId,

      normalBalance: getLedgerAccountNormalBalance(ELedgerType.Asset),
      code,
      materializedPath: code,
      type: ELedgerType.Asset,
      subType: EAssetSubType.Suspense,
      behavior: EAssetAccountBehavior.Default,
      meta: null,
      isControlAccount: false,
      controlAccountId: null,
      currency: payload.currency,
      status: ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraNotPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctNotPermitted,
      createdBy: payload.createdBy,
    });
  };
}

/** Prepares a unique liability suspense account; callers serialize allocation through commit. */
function makeCreateLiabilitySuspense(
  deps: IDependencies
): ISuspenseAccountService['createLiabilitySuspense'] {
  return async (payload, repoOptions) => {
    const accounts = await deps.ledgerAccountRepo.findBySubType(
      payload.accountingEntityId,
      ELedgerType.Liability,
      ELiabilitySubType.Suspense,
      repoOptions
    );
    const duplicate = accounts.find(
      (account) => account.currency?.code === payload.currency.code
    );
    if (duplicate) {
      throw new ledgerAccountError.SuspenseAccountAlreadyExists({
        accountingEntityId: payload.accountingEntityId,
        type: ELedgerType.Liability,
        currencyCode: payload.currency.code,
        accountId: duplicate.id,
      });
    }

    const latest = await deps.ledgerAccountRepo.findLatestBySubType(
      payload.accountingEntityId,
      ELedgerType.Liability,
      ELiabilitySubType.Suspense,
      repoOptions
    );

    const code = !latest
      ? LIABILITY_LEDGER_CODES.SUSPENSE_ACCOUNTS.INITIAL
      : getNextSubledgerAccountCode(
          LIABILITY_LEDGER_CODES.SUSPENSE_ACCOUNTS.PREFIX,
          latest.code as TLiabilitySuspenseLedgerCode
        );

    return ledgerAccountEntity.make({
      name: payload.name,
      accountingEntityId: payload.accountingEntityId,

      normalBalance: getLedgerAccountNormalBalance(ELedgerType.Liability),
      code,
      materializedPath: code,
      type: ELedgerType.Liability,
      subType: ELiabilitySubType.Suspense,
      behavior: ELiabilityAccountBehavior.Default,
      meta: null,
      isControlAccount: false,
      controlAccountId: null,
      currency: payload.currency,
      status: ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraNotPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctNotPermitted,
      createdBy: payload.createdBy,
    });
  };
}

export default function makeSuspenseAccountService(deps: IDependencies) {
  const service: ISuspenseAccountService = {
    createAssetSuspense: makeCreateAssetSuspense(deps),
    createLiabilitySuspense: makeCreateLiabilitySuspense(deps),
  };

  return Object.freeze(service);
}
