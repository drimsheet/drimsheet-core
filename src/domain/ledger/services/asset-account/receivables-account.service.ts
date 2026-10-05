import { ASSET_LEDGER_CODES } from '@domain/ledger/config/asset-codes.config';
import getLedgerAccountMaterializedPath from '@domain/ledger/entities/helpers/get-materialized-path.helper';
import getLedgerAccountNormalBalance from '@domain/ledger/entities/helpers/get-normal-balance.helper';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ledgerAccountCurrencyInvarianceRule from '@domain/ledger/rules/currency-invariance.rule';
import getLockedControlAccountHelper from '@domain/ledger/services/helpers/get-locked-control-account.helper';
import controlAccountAvailabilityValidation from '@domain/ledger/services/validations/control-account-availability.validation';
import receivablesControlAccountValidation from '@domain/ledger/services/validations/receivables-control-account.validation';
import {
  EAssetAccountBehavior,
  EAssetSubType,
} from '@domain/ledger/types/asset-account.types';
import ILedgerCodeAllocationService from '@domain/ledger/types/ledger-code-allocation.service.types';
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
  ledgerCodeAllocationService: ILedgerCodeAllocationService;
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

/** Prepares a final account under caller-owned family and parent locks; never writes. */
function makeCreateStatutoryReceivableSubAccount(
  deps: IDependencies
): IReceivablesAccountService['createStatutoryReceivableSubAccount'] {
  return async (payload, repoOptions) => {
    if (!repoOptions.tx)
      throw new ledgerAccountError.CodeAllocationTransactionRequired();

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

    receivablesControlAccountValidation.validateStatutoryReceivableSubAccount(
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
        type: ELedgerType.Asset,
        subType: EAssetSubType.Receivables,
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
      code: code as TReceivablesLedgerCode,
      materializedPath,
      normalBalance: getLedgerAccountNormalBalance(ELedgerType.Asset),
      type: ELedgerType.Asset,
      subType: EAssetSubType.Receivables,
      behavior: EAssetAccountBehavior.StatutoryReceivable,
      isControlAccount: payload.isControlAccount,
      controlAccountId: controlAccount.id,
      currency: payload.currency,
      meta: null,
      status: payload.status ?? ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraNotPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctNotPermitted,
      createdBy: payload.createdBy,
    });
  };
}

/** Prepares a final account under caller-owned family and parent locks; never writes. */
function makeCreateTradeReceivableSubAccount(
  deps: IDependencies
): IReceivablesAccountService['createTradeReceivableSubAccount'] {
  return async (payload, repoOptions) => {
    if (!repoOptions.tx)
      throw new ledgerAccountError.CodeAllocationTransactionRequired();

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

    receivablesControlAccountValidation.validateTradeReceivableSubAccount(
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
        type: ELedgerType.Asset,
        subType: EAssetSubType.Receivables,
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
      code: code as TReceivablesLedgerCode,
      materializedPath,
      normalBalance: getLedgerAccountNormalBalance(ELedgerType.Asset),
      type: ELedgerType.Asset,
      subType: EAssetSubType.Receivables,
      behavior: EAssetAccountBehavior.TradeReceivable,
      isControlAccount: payload.isControlAccount,
      controlAccountId: controlAccount.id,
      currency: payload.currency,
      meta: null,
      status: payload.status ?? ELedgerAccountStatus.Active,
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
      makeCreateStatutoryReceivableSubAccount(deps),

    createTradeReceivableSubAccount: makeCreateTradeReceivableSubAccount(deps),
  };

  return Object.freeze(service);
}
