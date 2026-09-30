import { EXPENSE_LEDGER_CODES } from '@domain/ledger/config/expense-codes.config';
import getLedgerAccountMaterializedPath from '@domain/ledger/entities/helpers/get-materialized-path.helper';
import getLedgerAccountNormalBalance from '@domain/ledger/entities/helpers/get-normal-balance.helper';
import getNextSubledgerAccountCode from '@domain/ledger/entities/helpers/get-subledger-code.helper';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ledgerAccountCurrencyInvarianceRule from '@domain/ledger/rules/currency-invariance.rule';
import financeCostControlAccountValidation from '@domain/ledger/services/validations/finance-cost-control-account.validation';
import {
  EExpenseAccountBehavior,
  EExpenseSubType,
} from '@domain/ledger/types/expense-account.types';
import { IFinanceCostAccountService } from '@domain/ledger/types/finance-cost.service.types';
import { TFinanceCostLedgerCode } from '@domain/ledger/types/ledger-code.types';
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
const LEDGER_CODE = EXPENSE_LEDGER_CODES.FINANCE_COST;

function makeCreateHeader(
  deps: IDependencies
): IFinanceCostAccountService['createHeader'] {
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
      subType: EExpenseSubType.FinanceCost,
      behavior: EExpenseAccountBehavior.FinanceCost,
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

function makeCreateSubAccount(): IFinanceCostAccountService['createSubAccount'] {
  return (payload) => {
    const { controlAccount } = payload;

    financeCostControlAccountValidation.validate(
      controlAccount,
      payload.accountingEntityId
    );

    ledgerAccountCurrencyInvarianceRule.validate({
      controlAccount,
      subAccountCurrency: null,
    });

    const code = getNextSubledgerAccountCode(
      LEDGER_CODE.PREFIX,
      controlAccount.code as TFinanceCostLedgerCode
    );
    const materializedPath =
      getLedgerAccountMaterializedPath<TFinanceCostLedgerCode>(
        controlAccount.materializedPath as TFinanceCostLedgerCode,
        code
      );

    return ledgerAccountEntity.make({
      name: payload.name,
      accountingEntityId: payload.accountingEntityId,
      code,
      materializedPath,
      normalBalance: getLedgerAccountNormalBalance(ELedgerType.Expense),
      type: ELedgerType.Expense,
      subType: EExpenseSubType.FinanceCost,
      behavior: EExpenseAccountBehavior.FinanceCost,
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

export default function makeFinanceCostAccountService(deps: IDependencies) {
  const service: IFinanceCostAccountService = {
    createHeader: makeCreateHeader(deps),
    createSubAccount: makeCreateSubAccount(),
  };
  return Object.freeze(service);
}
