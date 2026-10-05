import { LIABILITY_LEDGER_CODES } from '@domain/ledger/config/liability-codes.config';
import getLedgerAccountMaterializedPath from '@domain/ledger/entities/helpers/get-materialized-path.helper';
import getLedgerAccountNormalBalance from '@domain/ledger/entities/helpers/get-normal-balance.helper';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ledgerAccountCurrencyInvarianceRule from '@domain/ledger/rules/currency-invariance.rule';
import getLockedControlAccountHelper from '@domain/ledger/services/helpers/get-locked-control-account.helper';
import controlAccountAvailabilityValidation from '@domain/ledger/services/validations/control-account-availability.validation';
import payablesControlAccountValidation from '@domain/ledger/services/validations/payables-control-account.validation';
import ILedgerCodeAllocationService from '@domain/ledger/types/ledger-code-allocation.service.types';
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
  ledgerCodeAllocationService: ILedgerCodeAllocationService;
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

/** Prepares a final account under caller-owned family and parent locks; never writes. */
function makeCreateStatutoryPayableSubAccount(
  deps: IDependencies
): IPayablesAccountService['createStatutoryPayableSubAccount'] {
  return async (payload, repoOptions) => {
    if (!repoOptions.tx)
      throw new ledgerAccountError.CodeAllocationTransactionRequired();

    const meta = payablesMetaValue.makeStatutoryMeta(payload.meta);

    const controlAccount = await getLockedControlAccountHelper(
      deps.ledgerAccountRepo,
      {
        accountingEntityId: payload.accountingEntity.id,
        allocationHeaderCode: LEDGER_CODE.HEADER,
        defaultControlAccountCode: LEDGER_CODE.STATUTORY,
        controlAccountId: payload.controlAccountId,
      },
      repoOptions
    );

    controlAccountAvailabilityValidation.validate(controlAccount);

    payablesControlAccountValidation.validateStatutoryPayableSubAccount(
      controlAccount,
      payload.accountingEntity.id
    );

    ledgerAccountCurrencyInvarianceRule.validate({
      controlAccount,
      subAccountCurrency: payload.currency,
    });

    const code = await deps.ledgerCodeAllocationService.getNextCode(
      {
        accountingEntityId: payload.accountingEntity.id,
        type: ELedgerType.Liability,
        subType: ELiabilitySubType.Payable,
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
      accountingEntityId: payload.accountingEntity.id,
      code: code as TPayablesLedgerCode,
      materializedPath,
      normalBalance: getLedgerAccountNormalBalance(ELedgerType.Liability),
      type: ELedgerType.Liability,
      subType: ELiabilitySubType.Payable,
      behavior: ELiabilityAccountBehavior.TaxPayable,
      isControlAccount: payload.isControlAccount,
      controlAccountId: controlAccount.id,
      currency: payload.currency,
      status: payload.status ?? ELedgerAccountStatus.Active,
      meta,
      contraAccountRule: EContraAccountRule.ContraNotPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctNotPermitted,
      createdBy: payload.createdBy,
    });
  };
}

/** Prepares a final account under caller-owned family and parent locks; never writes. */
function makeCreateTradePayableAccount(
  deps: IDependencies
): IPayablesAccountService['createTradePayableSubAccount'] {
  return async (payload, repoOptions) => {
    if (!repoOptions.tx)
      throw new ledgerAccountError.CodeAllocationTransactionRequired();

    const meta = payablesMetaValue.makeTradeMeta(payload.meta);

    const controlAccount = await getLockedControlAccountHelper(
      deps.ledgerAccountRepo,
      {
        accountingEntityId: payload.accountingEntity.id,
        allocationHeaderCode: LEDGER_CODE.HEADER,
        defaultControlAccountCode: LEDGER_CODE.TRADE,
        controlAccountId: payload.controlAccountId,
      },
      repoOptions
    );

    controlAccountAvailabilityValidation.validate(controlAccount);

    payablesControlAccountValidation.validateTradePayableSubAccount(
      controlAccount,
      payload.accountingEntity.id
    );

    ledgerAccountCurrencyInvarianceRule.validate({
      controlAccount,
      subAccountCurrency: null,
    });

    const code = await deps.ledgerCodeAllocationService.getNextCode(
      {
        accountingEntityId: payload.accountingEntity.id,
        type: ELedgerType.Liability,
        subType: ELiabilitySubType.Payable,
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
      accountingEntityId: payload.accountingEntity.id,
      code: code as TPayablesLedgerCode,
      materializedPath,
      normalBalance: getLedgerAccountNormalBalance(ELedgerType.Liability),
      type: ELedgerType.Liability,
      subType: ELiabilitySubType.Payable,
      behavior: ELiabilityAccountBehavior.TradePayable,
      isControlAccount: payload.isControlAccount,
      controlAccountId: controlAccount.id,
      currency: null,
      status: payload.status ?? ELedgerAccountStatus.Active,
      meta,
      contraAccountRule: EContraAccountRule.ContraPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
      createdBy: payload.createdBy,
    });
  };
}

export default function makePayablesAccountService(deps: IDependencies) {
  const service: IPayablesAccountService = {
    createHeader: makeCreateHeader(deps),
    createStatutoryPayableSubAccount:
      makeCreateStatutoryPayableSubAccount(deps),
    createTradePayableSubAccount: makeCreateTradePayableAccount(deps),
  };

  return Object.freeze(service);
}
