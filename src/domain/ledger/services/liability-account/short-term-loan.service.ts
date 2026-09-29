import { LIABILITY_LEDGER_CODES } from '@domain/ledger/config/liability-codes.config';
import getLedgerAccountMaterializedPath from '@domain/ledger/entities/helpers/get-materialized-path.helper';
import getLedgerAccountNormalBalance from '@domain/ledger/entities/helpers/get-normal-balance.helper';
import getNextSubledgerAccountCode from '@domain/ledger/entities/helpers/get-subledger-code.helper';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ledgerAccountCurrencyInvarianceRule from '@domain/ledger/rules/currency-invariance.rule';
import shortTermLoanControlAccountValidation from '@domain/ledger/services/validations/short-term-loan-control-account.validation';
import { TShortTermDebtLedgerCode } from '@domain/ledger/types/ledger-code.types';
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
import { IShortTermLoanAccountService } from '@domain/ledger/types/short-term-loan.service.types';
import creditCardMetaValue from '@domain/ledger/values/credit-card-meta.vo';
import currencyEntity from '@domain/money/entities/currency.entity';

interface IDependencies {
  ledgerAccountRepo: ILedgerAccountRepo;
}

const LEDGER_CODE = LIABILITY_LEDGER_CODES.SHORT_TERM_DEBT;

/**
 *
 * Creates a new short term loan account header
 *
 * @returns Audited IShortTermDebtAccount
 *
 */
function makeCreateHeader(
  deps: IDependencies
): IShortTermLoanAccountService['createHeader'] {
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
      subType: ELiabilitySubType.ShortTermDebt,
      behavior: ELiabilityAccountBehavior.DefaultShortTermDebt,
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
 * Creates a new short term loan sub account
 *
 * @returns Audited IShortTermDebtAccount
 */
function makeCreateSubAccount(): IShortTermLoanAccountService['createSubAccount'] {
  return (payload) => {
    const { controlAccount } = payload;

    shortTermLoanControlAccountValidation.validate(
      controlAccount,
      payload.accountingEntityId
    );

    ledgerAccountCurrencyInvarianceRule.validate({
      controlAccount,
      subAccountCurrency: payload.currency,
    });

    const code = getNextSubledgerAccountCode(
      LEDGER_CODE.PREFIX,
      controlAccount.code as TShortTermDebtLedgerCode
    );

    const materializedPath =
      getLedgerAccountMaterializedPath<TShortTermDebtLedgerCode>(
        controlAccount.materializedPath as TShortTermDebtLedgerCode,
        code
      );

    return ledgerAccountEntity.make({
      name: payload.name,
      accountingEntityId: payload.accountingEntityId,
      code,
      materializedPath,
      normalBalance: getLedgerAccountNormalBalance(ELedgerType.Liability),
      type: ELedgerType.Liability,
      subType: ELiabilitySubType.ShortTermDebt,
      behavior: ELiabilityAccountBehavior.ShortTermLoan,
      isControlAccount: payload.isControlAccount,
      controlAccountId: controlAccount.id,
      currency: payload.currency,
      status: ELedgerAccountStatus.Active,
      meta: null,
      contraAccountRule: EContraAccountRule.ContraPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
      createdBy: payload.createdBy,
    });
  };
}

function makeCreateCreditCardSubAccount(): IShortTermLoanAccountService['createCreditCardSubAccount'] {
  return (payload) => {
    const { controlAccount } = payload;

    shortTermLoanControlAccountValidation.validateCreditCardSubAccount(
      controlAccount,
      payload.accountingEntityId
    );

    ledgerAccountCurrencyInvarianceRule.validate({
      controlAccount,
      subAccountCurrency: payload.currency,
    });

    const code = getNextSubledgerAccountCode(
      LEDGER_CODE.PREFIX,
      controlAccount.code as TShortTermDebtLedgerCode
    );

    const materializedPath =
      getLedgerAccountMaterializedPath<TShortTermDebtLedgerCode>(
        controlAccount.materializedPath as TShortTermDebtLedgerCode,
        code
      );

    return ledgerAccountEntity.make({
      name: payload.name,
      accountingEntityId: payload.accountingEntityId,
      code,
      materializedPath,
      normalBalance: getLedgerAccountNormalBalance(ELedgerType.Liability),
      type: ELedgerType.Liability,
      subType: ELiabilitySubType.ShortTermDebt,
      behavior: ELiabilityAccountBehavior.CreditCard,
      isControlAccount: payload.isControlAccount,
      controlAccountId: controlAccount.id,
      currency: payload.currency,
      status: ELedgerAccountStatus.Active,
      meta: creditCardMetaValue.make(payload.meta),
      contraAccountRule: EContraAccountRule.ContraPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
      createdBy: payload.createdBy,
    });
  };
}

export default function makeShortTermLoanService(deps: IDependencies) {
  const service: IShortTermLoanAccountService = {
    createHeader: makeCreateHeader(deps),
    createSubAccount: makeCreateSubAccount(),
    createCreditCardSubAccount: makeCreateCreditCardSubAccount(),
  };

  return Object.freeze(service);
}
