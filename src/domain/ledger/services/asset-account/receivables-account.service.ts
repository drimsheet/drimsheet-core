import { ASSET_LEDGER_CODES } from '@domain/ledger/config/asset-codes.config';
import getLedgerAccountMaterializedPath from '@domain/ledger/entities/helpers/get-materialized-path.helper';
import getLedgerAccountNormalBalance from '@domain/ledger/entities/helpers/get-normal-balance.helper';
import getNextSubledgerAccountCode from '@domain/ledger/entities/helpers/get-subledger-code.helper';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ledgerAccountCurrencyInvarianceRule from '@domain/ledger/rules/currency-invariance.rule';
import receivablesControlAccountValidation from '@domain/ledger/services/validations/receivables-control-account.validation';
import {
  EAssetAccountBehavior,
  EAssetSubType,
} from '@domain/ledger/types/asset-account.types';
import { TReceivablesLedgerCode } from '@domain/ledger/types/ledger-code.types';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerAccountStatus,
  ELedgerType,
} from '@domain/ledger/types/ledger.types';
import { IReceivablesAccountService } from '@domain/ledger/types/receivables-account.service.types';
import currencyEntity from '@domain/money/entities/currency.entity';

interface IDependencies {
  ledgerAccountRepo: ILedgerAccountRepo;
}

const LEDGER_CODE = ASSET_LEDGER_CODES.RECEIVABLES;

/**
 *
 * Creates a statutory receivable header account
 *
 * @returns Audited IReceivablesAccount
 *
 */
function makeCreateHeader(
  deps: IDependencies
): IReceivablesAccountService['createHeader'] {
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
      normalBalance: getLedgerAccountNormalBalance(ELedgerType.Asset),
      type: ELedgerType.Asset,
      subType: EAssetSubType.Receivables,
      behavior: EAssetAccountBehavior.DefaultReceivables,
      isControlAccount: true,
      controlAccountId: null,
      currency,
      meta: null,
      status: ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
      createdBy: payload.createdBy,
    });
  };
}

/**
 *
 * Creates a statutory receivable sub account account
 *
 * @returns Audited IReceivablesAccount
 *
 */
function makeCreateStatutoryReceivableSubAccount(): IReceivablesAccountService['createStatutoryReceivableSubAccount'] {
  return (payload) => {
    const { controlAccount } = payload;

    receivablesControlAccountValidation.validateStatutoryReceivableSubAccount(
      controlAccount,
      payload.accountingEntity.id
    );

    ledgerAccountCurrencyInvarianceRule.validate({
      controlAccount,
      subAccountCurrency: payload.currency,
    });

    const code = getNextSubledgerAccountCode(
      LEDGER_CODE.PREFIX,
      controlAccount.code as TReceivablesLedgerCode
    );

    const materializedPath =
      getLedgerAccountMaterializedPath<TReceivablesLedgerCode>(
        controlAccount.materializedPath as TReceivablesLedgerCode,
        code
      );

    return ledgerAccountEntity.make({
      name: payload.name,
      accountingEntityId: payload.accountingEntity.id,
      code,
      materializedPath,
      normalBalance: getLedgerAccountNormalBalance(ELedgerType.Asset),
      type: ELedgerType.Asset,
      subType: EAssetSubType.Receivables,
      behavior: EAssetAccountBehavior.StatutoryReceivable,
      isControlAccount: payload.isControlAccount,
      controlAccountId: controlAccount.id,
      currency: payload.currency,
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
 * Creates a trade receivable sub account account
 *
 * @returns Audited IReceivablesAccount
 *
 */
function makeCreateTradeReceivableSubAccount(): IReceivablesAccountService['createTradeReceivableSubAccount'] {
  return (payload) => {
    const { controlAccount } = payload;

    receivablesControlAccountValidation.validateTradeReceivableSubAccount(
      controlAccount,
      payload.accountingEntity.id
    );

    ledgerAccountCurrencyInvarianceRule.validate({
      controlAccount,
      subAccountCurrency: payload.currency,
    });

    const code = getNextSubledgerAccountCode(
      LEDGER_CODE.PREFIX,
      controlAccount.code as TReceivablesLedgerCode
    );

    const materializedPath =
      getLedgerAccountMaterializedPath<TReceivablesLedgerCode>(
        controlAccount.materializedPath as TReceivablesLedgerCode,
        code
      );

    return ledgerAccountEntity.make({
      name: payload.name,
      accountingEntityId: payload.accountingEntity.id,
      code,
      materializedPath,
      normalBalance: getLedgerAccountNormalBalance(ELedgerType.Asset),
      type: ELedgerType.Asset,
      subType: EAssetSubType.Receivables,
      behavior: EAssetAccountBehavior.TradeReceivable,
      isControlAccount: payload.isControlAccount,
      controlAccountId: controlAccount.id,
      currency: payload.currency,
      meta: null,
      status: ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
      createdBy: payload.createdBy,
    });
  };
}

export default function makeReceivablesAccountService(deps: IDependencies) {
  const service: IReceivablesAccountService = {
    createHeader: makeCreateHeader(deps),

    createStatutoryReceivableSubAccount:
      makeCreateStatutoryReceivableSubAccount(),

    createTradeReceivableSubAccount: makeCreateTradeReceivableSubAccount(),
  };

  return Object.freeze(service);
}
