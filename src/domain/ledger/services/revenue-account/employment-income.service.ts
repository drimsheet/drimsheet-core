import { REVENUE_LEDGER_CODES } from '@domain/ledger/config/revenue-codes.config';
import getLedgerAccountMaterializedPath from '@domain/ledger/entities/helpers/get-materialized-path.helper';
import getLedgerAccountNormalBalance from '@domain/ledger/entities/helpers/get-normal-balance.helper';
import getNextSubledgerAccountCode from '@domain/ledger/entities/helpers/get-subledger-code.helper';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ledgerAccountCurrencyInvarianceRule from '@domain/ledger/rules/currency-invariance.rule';
import employmentIncomeControlAccountValidation from '@domain/ledger/services/validations/employment-income-control-account.validation';
import { IEmploymentIncomeAccountService } from '@domain/ledger/types/employment-income.service.types';
import { TEmploymentIncomeLedgerCode } from '@domain/ledger/types/ledger-code.types';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerAccountStatus,
  ELedgerType,
} from '@domain/ledger/types/ledger.types';
import {
  ERevenueAccountBehavior,
  ERevenueSubType,
} from '@domain/ledger/types/revenue-account.types';
import currencyEntity from '@domain/money/entities/currency.entity';

interface IDependencies {
  ledgerAccountRepo: ILedgerAccountRepo;
}

const LEDGER_CODE = REVENUE_LEDGER_CODES.EMPLOYMENT_INCOME;

function makeCreateHeader(
  deps: IDependencies
): IEmploymentIncomeAccountService['createHeader'] {
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
      normalBalance: getLedgerAccountNormalBalance(ELedgerType.Revenue),
      type: ELedgerType.Revenue,
      subType: ERevenueSubType.EmploymentIncome,
      behavior: ERevenueAccountBehavior.EmploymentIncome,
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

function makeCreateSubAccount(): IEmploymentIncomeAccountService['createSubAccount'] {
  return (payload) => {
    const { controlAccount } = payload;

    employmentIncomeControlAccountValidation.validate(
      controlAccount,
      payload.accountingEntityId
    );

    ledgerAccountCurrencyInvarianceRule.validate({
      controlAccount,
      subAccountCurrency: null,
    });

    const code = getNextSubledgerAccountCode(
      LEDGER_CODE.PREFIX,
      controlAccount.code as TEmploymentIncomeLedgerCode
    );

    const materializedPath =
      getLedgerAccountMaterializedPath<TEmploymentIncomeLedgerCode>(
        controlAccount.materializedPath as TEmploymentIncomeLedgerCode,
        code
      );

    return ledgerAccountEntity.make({
      name: payload.name,
      accountingEntityId: payload.accountingEntityId,
      code,
      materializedPath,
      normalBalance: getLedgerAccountNormalBalance(ELedgerType.Revenue),
      type: ELedgerType.Revenue,
      subType: ERevenueSubType.EmploymentIncome,
      behavior: ERevenueAccountBehavior.EmploymentIncome,
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

export default function makeEmploymentIncomeAccountService(
  deps: IDependencies
) {
  const service: IEmploymentIncomeAccountService = {
    createHeader: makeCreateHeader(deps),
    createSubAccount: makeCreateSubAccount(),
  };

  return Object.freeze(service);
}
