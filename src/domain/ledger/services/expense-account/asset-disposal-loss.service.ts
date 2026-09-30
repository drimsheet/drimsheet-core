import { EXPENSE_LEDGER_CODES } from '@domain/ledger/config/expense-codes.config';
import getLedgerAccountMaterializedPath from '@domain/ledger/entities/helpers/get-materialized-path.helper';
import getLedgerAccountNormalBalance from '@domain/ledger/entities/helpers/get-normal-balance.helper';
import getNextSubledgerAccountCode from '@domain/ledger/entities/helpers/get-subledger-code.helper';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ledgerAccountCurrencyInvarianceRule from '@domain/ledger/rules/currency-invariance.rule';
import assetDisposalLossControlAccountValidation from '@domain/ledger/services/validations/asset-disposal-loss-control-account.validation';
import { IAssetDisposalLossAccountService } from '@domain/ledger/types/asset-disposal-loss.service.types';
import {
  EExpenseAccountBehavior,
  EExpenseSubType,
} from '@domain/ledger/types/expense-account.types';
import { TAssetDisposalLossLedgerCode } from '@domain/ledger/types/ledger-code.types';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerAccountStatus,
  ELedgerType,
} from '@domain/ledger/types/ledger.types';
import currencyEntity from '@domain/money/entities/currency.entity';

interface IDependencies {
  ledgerAccountRepo: ILedgerAccountRepo;
}

const LEDGER_CODE = EXPENSE_LEDGER_CODES.ASSET_DISPOSAL_LOSS;

/**
 *
 * Creates a new asset disposal loss header account
 *
 * @returns Audited IAssetDisposalLossAccount
 *
 */
function makeCreateHeader(
  deps: IDependencies
): IAssetDisposalLossAccountService['createHeader'] {
  return async (payload, repoOptions) => {
    const existingHeader = await deps.ledgerAccountRepo.findByCode(
      LEDGER_CODE.HEADER,
      payload.accountingEntity.id,
      repoOptions
    );

    if (existingHeader) {
      throw new ledgerAccountError.HeaderAccountAlreadyExists({
        existingHeader,
      });
    }

    const currency = currencyEntity.getByCode(
      payload.accountingEntity.functionalCurrencyCode
    );

    return ledgerAccountEntity.make({
      name: payload.name,
      accountingEntityId: payload.accountingEntity.id,
      code: LEDGER_CODE.HEADER,
      materializedPath: LEDGER_CODE.HEADER,
      normalBalance: getLedgerAccountNormalBalance(ELedgerType.Expense),
      type: ELedgerType.Expense,
      subType: EExpenseSubType.LossOnAssetDisposal,
      behavior: EExpenseAccountBehavior.AssetDisposalLoss,
      isControlAccount: true,
      controlAccountId: null,
      currency,
      meta: null,
      status: ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraNotPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctNotPermitted,
      createdBy: payload.createdBy,
    });
  };
}

/**
 *
 * Creates a new asset disposal loss sub account
 *
 * @returns Audited IAssetDisposalLossAccount
 *
 */
function makeCreateSubAccount(): IAssetDisposalLossAccountService['createSubAccount'] {
  return (payload) => {
    const { controlAccount } = payload;

    assetDisposalLossControlAccountValidation.validate(
      controlAccount,
      payload.accountingEntityId
    );

    ledgerAccountCurrencyInvarianceRule.validate({
      controlAccount,
      subAccountCurrency: null,
    });

    const code = getNextSubledgerAccountCode(
      LEDGER_CODE.PREFIX,
      controlAccount.code as TAssetDisposalLossLedgerCode
    );

    const materializedPath =
      getLedgerAccountMaterializedPath<TAssetDisposalLossLedgerCode>(
        controlAccount.materializedPath as TAssetDisposalLossLedgerCode,
        code
      );

    return ledgerAccountEntity.make({
      name: payload.name,
      accountingEntityId: payload.accountingEntityId,
      code,
      materializedPath,
      normalBalance: getLedgerAccountNormalBalance(ELedgerType.Expense),
      type: ELedgerType.Expense,
      subType: EExpenseSubType.LossOnAssetDisposal,
      behavior: EExpenseAccountBehavior.AssetDisposalLoss,
      isControlAccount: payload.isControlAccount,
      controlAccountId: controlAccount.id,
      currency: null,
      meta: null,
      status: ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraNotPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctNotPermitted,
      createdBy: payload.createdBy,
    });
  };
}

export default function makeAssetDisposalService(deps: IDependencies) {
  const service: IAssetDisposalLossAccountService = {
    createHeader: makeCreateHeader(deps),
    createSubAccount: makeCreateSubAccount(),
  };

  return Object.freeze(service);
}
