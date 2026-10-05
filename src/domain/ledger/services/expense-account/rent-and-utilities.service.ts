import { EXPENSE_LEDGER_CODES } from '@domain/ledger/config/expense-codes.config';
import getLedgerAccountMaterializedPath from '@domain/ledger/entities/helpers/get-materialized-path.helper';
import getLedgerAccountNormalBalance from '@domain/ledger/entities/helpers/get-normal-balance.helper';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ledgerAccountCurrencyInvarianceRule from '@domain/ledger/rules/currency-invariance.rule';
import getLockedControlAccountHelper from '@domain/ledger/services/helpers/get-locked-control-account.helper';
import controlAccountAvailabilityValidation from '@domain/ledger/services/validations/control-account-availability.validation';
import rentAndUtilitiesControlAccountValidation from '@domain/ledger/services/validations/rent-and-utilities-control-account.validation';
import {
  EExpenseAccountBehavior,
  EExpenseSubType,
} from '@domain/ledger/types/expense-account.types';
import ILedgerCodeAllocationService from '@domain/ledger/types/ledger-code-allocation.service.types';
import { TRentUtilitiesLedgerCode } from '@domain/ledger/types/ledger-code.types';
import {
  EAdjunctAccountRule,
  EContraAccountRule,
  ELedgerAccountStatus,
  ELedgerType,
} from '@domain/ledger/types/ledger.types';
import { IRentAndUtilitiesAccountService } from '@domain/ledger/types/rent-and-utilities.service.types';
import currencyEntity from '@domain/money/entities/currency.entity';

interface IDependencies {
  ledgerAccountRepo: ILedgerAccountRepo;
  ledgerCodeAllocationService: ILedgerCodeAllocationService;
}
const LEDGER_CODE = EXPENSE_LEDGER_CODES.RENT_AND_UTILITIES;

function makeCreateHeader(
  deps: IDependencies
): IRentAndUtilitiesAccountService['createHeader'] {
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
      subType: EExpenseSubType.RentAndUtilities,
      behavior: EExpenseAccountBehavior.RentAndUtilities,
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
): IRentAndUtilitiesAccountService['createSubAccount'] {
  return async (payload, repoOptions) => {
    if (!repoOptions.tx)
      throw new ledgerAccountError.CodeAllocationTransactionRequired();

    const controlAccount = await getLockedControlAccountHelper(
      deps.ledgerAccountRepo,
      {
        accountingEntityId: payload.accountingEntityId,
        allocationHeaderCode: LEDGER_CODE.HEADER,
        defaultControlAccountCode: LEDGER_CODE.HEADER,
        controlAccountId: payload.controlAccountId,
      },
      repoOptions
    );

    controlAccountAvailabilityValidation.validate(controlAccount);

    rentAndUtilitiesControlAccountValidation.validate(
      controlAccount,
      payload.accountingEntityId
    );

    ledgerAccountCurrencyInvarianceRule.validate({
      controlAccount,
      subAccountCurrency: null,
    });

    const code = await deps.ledgerCodeAllocationService.getNextCode(
      {
        accountingEntityId: payload.accountingEntityId,
        type: ELedgerType.Expense,
        subType: EExpenseSubType.RentAndUtilities,
        allocationHeaderCode: LEDGER_CODE.HEADER,
      },
      repoOptions
    );
    const materializedPath = getLedgerAccountMaterializedPath(
      controlAccount.materializedPath,
      code
    );
    return ledgerAccountEntity.make({
      name: payload.name,
      accountingEntityId: payload.accountingEntityId,
      code: code as TRentUtilitiesLedgerCode,
      materializedPath,
      normalBalance: getLedgerAccountNormalBalance(ELedgerType.Expense),
      type: ELedgerType.Expense,
      subType: EExpenseSubType.RentAndUtilities,
      behavior: EExpenseAccountBehavior.RentAndUtilities,
      isControlAccount: payload.isControlAccount,
      controlAccountId: controlAccount.id,
      currency: null,
      meta: null,
      status: payload.status ?? ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraNotPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctNotPermitted,
      createdBy: payload.createdBy,
    });
  };
}

export default function makeRentAndUtilitiesAccountService(
  deps: IDependencies
) {
  const service: IRentAndUtilitiesAccountService = {
    createHeader: makeCreateHeader(deps),
    createSubAccount: makeCreateSubAccount(deps),
  };
  return Object.freeze(service);
}
