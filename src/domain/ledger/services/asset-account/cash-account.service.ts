import { ASSET_LEDGER_CODES } from '@domain/ledger/config/asset-codes.config';
import getLedgerAccountMaterializedPath from '@domain/ledger/entities/helpers/get-materialized-path.helper';
import getLedgerAccountNormalBalance from '@domain/ledger/entities/helpers/get-normal-balance.helper';
import getNextSubledgerAccountCode from '@domain/ledger/entities/helpers/get-subledger-code.helper';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ledgerAccountCurrencyInvarianceRule from '@domain/ledger/rules/currency-invariance.rule';
import cashControlAccountValidation from '@domain/ledger/services/validations/cash-control-account.validation';
import {
  EAssetAccountBehavior,
  EAssetSubType,
} from '@domain/ledger/types/asset-account.types';
import ICashAccountService from '@domain/ledger/types/cash-account.service.types';
import { TCashLedgerCode } from '@domain/ledger/types/ledger-code.types';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerAccountStatus,
  ELedgerType,
} from '@domain/ledger/types/ledger.types';
import bankDetailsValue from '@domain/ledger/values/bank-details.vo';
import currencyEntity from '@domain/money/entities/currency.entity';

interface IDependencies {
  ledgerAccountRepo: ILedgerAccountRepo;
}

const LEDGER_CODE = ASSET_LEDGER_CODES.CASH_AND_EQUIVALENTS;

/**
 *
 * Creates a new cash account header account
 *
 * @returns Audited ICashAndCashEquivalentAccount
 *
 */
function makeCreateHeader(
  deps: IDependencies
): ICashAccountService['createHeader'] {
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
      subType: EAssetSubType.CashAndCashEquivalent,
      behavior: EAssetAccountBehavior.DefaultCash,
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
 * Validates the supplied parent and creates a petty-cash account in memory.
 *
 * @returns Audited ICashAndCashEquivalentAccount
 *
 */
function makeCreatePettyCashSubAccount(): ICashAccountService['createPettyCashSubAccount'] {
  return (payload) => {
    const { controlAccount } = payload;
    cashControlAccountValidation.validate(
      controlAccount,
      payload.accountingEntity.id,
      EAssetAccountBehavior.PettyCash
    );

    ledgerAccountCurrencyInvarianceRule.validate({
      controlAccount,
      subAccountCurrency: payload.currency,
    });

    const code = getNextSubledgerAccountCode(
      LEDGER_CODE.PREFIX,
      controlAccount.code as TCashLedgerCode
    );

    const materializedPath = getLedgerAccountMaterializedPath<TCashLedgerCode>(
      controlAccount.materializedPath as TCashLedgerCode,
      code
    );

    return ledgerAccountEntity.make({
      name: payload.name,
      accountingEntityId: payload.accountingEntity.id,
      code,
      materializedPath,
      normalBalance: getLedgerAccountNormalBalance(ELedgerType.Asset),
      type: ELedgerType.Asset,
      subType: EAssetSubType.CashAndCashEquivalent,
      behavior: EAssetAccountBehavior.PettyCash,
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

/**
 *
 * Validates the supplied parent and creates a bank account in memory.
 *
 * @returns Audited ICashAndCashEquivalentAccount
 *
 */
function makeCreateBankSubAccount(): ICashAccountService['createBankSubAccount'] {
  return (payload) => {
    const { controlAccount } = payload;
    cashControlAccountValidation.validate(
      controlAccount,
      payload.accountingEntity.id,
      EAssetAccountBehavior.Bank
    );

    ledgerAccountCurrencyInvarianceRule.validate({
      controlAccount,
      subAccountCurrency: payload.currency,
    });

    const code = getNextSubledgerAccountCode(
      LEDGER_CODE.PREFIX,
      controlAccount.code as TCashLedgerCode
    );

    const materializedPath = getLedgerAccountMaterializedPath<TCashLedgerCode>(
      controlAccount.materializedPath as TCashLedgerCode,
      code
    );

    return ledgerAccountEntity.make({
      name: payload.name,
      accountingEntityId: payload.accountingEntity.id,
      code,
      materializedPath,
      normalBalance: getLedgerAccountNormalBalance(ELedgerType.Asset),
      type: ELedgerType.Asset,
      subType: EAssetSubType.CashAndCashEquivalent,
      behavior: EAssetAccountBehavior.Bank,
      isControlAccount: payload.isControlAccount,
      controlAccountId: controlAccount.id,
      currency: payload.currency,
      meta: bankDetailsValue.make(payload.bankDetails),
      status: ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
      createdBy: payload.createdBy,
    });
  };
}

/**
 * ================================ MAIN SERVICE ================================
 * @param deps
 * @returns d
 */

export default function makeCashAccountService(
  deps: IDependencies
): ICashAccountService {
  const service: ICashAccountService = {
    createHeader: makeCreateHeader(deps),
    createPettyCashSubAccount: makeCreatePettyCashSubAccount(),
    createBankSubAccount: makeCreateBankSubAccount(),
  };

  return Object.freeze(service);
}
