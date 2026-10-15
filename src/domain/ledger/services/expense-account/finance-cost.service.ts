import { EXPENSE_LEDGER_CODES } from '@domain/ledger/config/expense-codes.config';
import getLedgerAccountMaterializedPath from '@domain/ledger/entities/helpers/get-materialized-path.helper';
import getLedgerAccountNormalBalance from '@domain/ledger/entities/helpers/get-normal-balance.helper';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ledgerAccountCurrencyInvarianceRule from '@domain/ledger/rules/currency-invariance.rule';
import getLockedControlAccountHelper from '@domain/ledger/services/helpers/get-locked-control-account.helper';
import controlAccountAvailabilityValidation from '@domain/ledger/services/validations/control-account-availability.validation';
import controlAccountChildStatusValidation from '@domain/ledger/services/validations/control-account-child-status.validation';
import financeCostControlAccountValidation from '@domain/ledger/services/validations/finance-cost-control-account.validation';
import {
  EExpenseAccountBehavior,
  EExpenseSubType,
  IFinanceCostAccount,
} from '@domain/ledger/types/expense-account.types';
import { IFinanceCostAccountService } from '@domain/ledger/types/finance-cost.service.types';
import ILedgerAccountService from '@domain/ledger/types/ledger-account.service.types';
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
  ledgerAccountService: ILedgerAccountService;
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

    return ledgerAccountEntity.make<IFinanceCostAccount>({
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

/** Prepares a final account under caller-owned family and parent locks; never writes. */
function makeCreateSubAccount(
  deps: IDependencies
): IFinanceCostAccountService['createSubAccount'] {
  return async (payload, repoOptions) => {
    if (!repoOptions.tx) {
      throw new ledgerAccountError.CodeAllocationTransactionRequired();
    }

    const selectedControlAccount = await getLockedControlAccountHelper(
      deps.ledgerAccountRepo,
      {
        accountingEntityId: payload.accountingEntityId,
        allocationHeaderCode: LEDGER_CODE.HEADER,
        defaultControlAccountCode: LEDGER_CODE.HEADER,
        controlAccountId: payload.controlAccountId,
      },
      repoOptions
    );

    controlAccountAvailabilityValidation.validate(selectedControlAccount);

    const status = payload.status ?? ELedgerAccountStatus.Active;
    controlAccountChildStatusValidation.validate(
      selectedControlAccount.status,
      status
    );

    financeCostControlAccountValidation.validate(
      selectedControlAccount,
      payload.accountingEntityId
    );

    ledgerAccountCurrencyInvarianceRule.validate({
      controlAccount: selectedControlAccount,
      subAccountCurrency: null,
    });

    const promotion = selectedControlAccount.isControlAccount
      ? undefined
      : await deps.ledgerAccountService.promotePostingToControlAccount(
          selectedControlAccount,
          payload.createdBy,
          repoOptions,
          payload.promotionNames
        );
    const controlAccount =
      promotion?.controlAccount[0] ?? selectedControlAccount;

    const code = await deps.ledgerAccountService.getNextCode(
      {
        accountingEntityId: payload.accountingEntityId,
        type: ELedgerType.Expense,
        subType: EExpenseSubType.FinanceCost,
        allocationHeaderCode: LEDGER_CODE.HEADER,
        reservedCode: promotion?.postingAccount[0].code,
      },
      repoOptions
    );
    const materializedPath = getLedgerAccountMaterializedPath(
      controlAccount.materializedPath,
      code
    );

    const auditedAccount = ledgerAccountEntity.make<IFinanceCostAccount>({
      name: payload.name,
      accountingEntityId: payload.accountingEntityId,
      code: code as TFinanceCostLedgerCode,
      materializedPath,
      normalBalance: getLedgerAccountNormalBalance(ELedgerType.Expense),
      type: ELedgerType.Expense,
      subType: EExpenseSubType.FinanceCost,
      behavior: EExpenseAccountBehavior.FinanceCost,
      isControlAccount: payload.isControlAccount,
      controlAccountId: controlAccount.id,
      currency: null,
      meta: null,
      status,
      contraAccountRule: EContraAccountRule.ContraNotPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctNotPermitted,
      createdBy: payload.createdBy,
    });
    return promotion ? [...auditedAccount, promotion] : auditedAccount;
  };
}

export default function makeFinanceCostAccountService(deps: IDependencies) {
  const service: IFinanceCostAccountService = {
    createHeader: makeCreateHeader(deps),
    createSubAccount: makeCreateSubAccount(deps),
  };
  return Object.freeze(service);
}
