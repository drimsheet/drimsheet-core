import { LIABILITY_LEDGER_CODES } from '@domain/ledger/config/liability-codes.config';
import getLedgerAccountMaterializedPath from '@domain/ledger/entities/helpers/get-materialized-path.helper';
import getLedgerAccountNormalBalance from '@domain/ledger/entities/helpers/get-normal-balance.helper';
import getNextSubledgerAccountCode from '@domain/ledger/entities/helpers/get-subledger-code.helper';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ledgerAccountCurrencyInvarianceRule from '@domain/ledger/rules/currency-invariance.rule';
import payablesControlAccountValidation from '@domain/ledger/services/validations/payables-control-account.validation';
import { TPayablesLedgerCode } from '@domain/ledger/types/ledger-code.types';
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
import { IPayablesAccountService } from '@domain/ledger/types/payables.service.types';
import payablesMetaValue from '@domain/ledger/values/payables-meta.vo.';
import currencyEntity from '@domain/money/entities/currency.entity';

interface IDependencies {
  ledgerAccountRepo: ILedgerAccountRepo;
}

const LEDGER_CODE = LIABILITY_LEDGER_CODES.PAYABLES;

/**
 *
 * Creates a new payable account header
 *
 * @returns Audited IPayableAccount
 *
 */
function makeCreateHeader(
  deps: IDependencies
): IPayablesAccountService['createHeader'] {
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
      normalBalance: getLedgerAccountNormalBalance(ELedgerType.Liability),
      type: ELedgerType.Liability,
      subType: ELiabilitySubType.Payable,
      behavior: ELiabilityAccountBehavior.DefaultPayable,
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
 * Creates a new statutory payable account
 *
 * @returns Audited IPayableAccount
 *
 */
function makeCreateStatutoryPayableSubAccount(): IPayablesAccountService['createStatutoryPayableSubAccount'] {
  return (payload) => {
    const { controlAccount } = payload;

    payablesControlAccountValidation.validateStatutoryPayableSubAccount(
      controlAccount,
      payload.accountingEntity.id
    );

    ledgerAccountCurrencyInvarianceRule.validate({
      controlAccount,
      subAccountCurrency: payload.currency,
    });

    const code = getNextSubledgerAccountCode(
      LEDGER_CODE.PREFIX,
      controlAccount.code as TPayablesLedgerCode
    );

    const materializedPath =
      getLedgerAccountMaterializedPath<TPayablesLedgerCode>(
        controlAccount.materializedPath as TPayablesLedgerCode,
        code
      );

    return ledgerAccountEntity.make({
      name: payload.name,
      accountingEntityId: payload.accountingEntity.id,
      code,
      materializedPath,
      normalBalance: getLedgerAccountNormalBalance(ELedgerType.Liability),
      type: ELedgerType.Liability,
      subType: ELiabilitySubType.Payable,
      behavior: ELiabilityAccountBehavior.TaxPayable,
      isControlAccount: payload.isControlAccount,
      controlAccountId: controlAccount.id,
      currency: payload.currency,
      status: ELedgerAccountStatus.Active,
      meta: payablesMetaValue.makeStatutoryMeta(payload.meta),
      contraAccountRule: EContraAccountRule.ContraNotPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctNotPermitted,
      createdBy: payload.createdBy,
    });
  };
}

/**
 *
 * Creates a new payable account header
 *
 * @returns Audited IPayableAccount
 *
 */

function makeCreateTradePayableAccount(): IPayablesAccountService['createTradePayableSubAccount'] {
  return (payload) => {
    const { controlAccount } = payload;

    payablesControlAccountValidation.validateTradePayableSubAccount(
      controlAccount,
      payload.accountingEntity.id
    );

    ledgerAccountCurrencyInvarianceRule.validate({
      controlAccount,
      subAccountCurrency: null,
    });

    const code = getNextSubledgerAccountCode(
      LEDGER_CODE.PREFIX,
      controlAccount.code as TPayablesLedgerCode
    );

    const materializedPath =
      getLedgerAccountMaterializedPath<TPayablesLedgerCode>(
        controlAccount.materializedPath as TPayablesLedgerCode,
        code
      );

    return ledgerAccountEntity.make({
      name: payload.name,
      accountingEntityId: payload.accountingEntity.id,
      code,
      materializedPath,
      normalBalance: getLedgerAccountNormalBalance(ELedgerType.Liability),
      type: ELedgerType.Liability,
      subType: ELiabilitySubType.Payable,
      behavior: ELiabilityAccountBehavior.TradePayable,
      isControlAccount: payload.isControlAccount,
      controlAccountId: controlAccount.id,
      currency: null,
      status: ELedgerAccountStatus.Active,
      meta: payablesMetaValue.makeTradeMeta(payload.meta),
      contraAccountRule: EContraAccountRule.ContraPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
      createdBy: payload.createdBy,
    });
  };
}

export default function makePayablesAccountService(deps: IDependencies) {
  const service: IPayablesAccountService = {
    createHeader: makeCreateHeader(deps),
    createStatutoryPayableSubAccount: makeCreateStatutoryPayableSubAccount(),
    createTradePayableSubAccount: makeCreateTradePayableAccount(),
  };

  return Object.freeze(service);
}
