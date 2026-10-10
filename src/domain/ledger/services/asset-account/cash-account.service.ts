import { ASSET_LEDGER_CODES } from '@domain/ledger/config/asset-codes.config';
import getLedgerAccountMaterializedPath from '@domain/ledger/entities/helpers/get-materialized-path.helper';
import getLedgerAccountNormalBalance from '@domain/ledger/entities/helpers/get-normal-balance.helper';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import IBankAccountRepo from '@domain/ledger/repos/bank-account.repo';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ledgerAccountCurrencyInvarianceRule from '@domain/ledger/rules/currency-invariance.rule';
import getLockedControlAccountHelper from '@domain/ledger/services/helpers/get-locked-control-account.helper';
import cashControlAccountValidation from '@domain/ledger/services/validations/cash-control-account.validation';
import controlAccountAvailabilityValidation from '@domain/ledger/services/validations/control-account-availability.validation';
import {
  EAssetAccountBehavior,
  EAssetSubType,
  IPettyCashAccount,
} from '@domain/ledger/types/asset-account.types';
import ICashAccountService from '@domain/ledger/types/cash-account.service.types';
import ILedgerCodeAllocationService from '@domain/ledger/types/ledger-code-allocation.service.types';
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
  bankAccountRepo: IBankAccountRepo;
  ledgerCodeAllocationService: ILedgerCodeAllocationService;
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

/** Creates a final account under caller-owned family and parent locks; never writes. */
function makeCreatePettyCashSubAccount(
  deps: IDependencies
): ICashAccountService['createPettyCashSubAccount'] {
  return async (payload, repoOptions) => {
    if (!repoOptions.tx)
      throw new ledgerAccountError.CodeAllocationTransactionRequired();

    const controlAccount = await getLockedControlAccountHelper(
      deps.ledgerAccountRepo,
      {
        accountingEntityId: payload.accountingEntity.id,
        allocationHeaderCode: LEDGER_CODE.HEADER,
        defaultControlAccountCode: LEDGER_CODE.HEADER,
        controlAccountId: payload.controlAccountId,
      },
      repoOptions
    );

    controlAccountAvailabilityValidation.validate(controlAccount);

    cashControlAccountValidation.validate(
      controlAccount,
      payload.accountingEntity.id,
      EAssetAccountBehavior.PettyCash
    );

    ledgerAccountCurrencyInvarianceRule.validate({
      controlAccount,
      subAccountCurrency: payload.currency,
    });

    const code = await deps.ledgerCodeAllocationService.getNextCode(
      {
        accountingEntityId: payload.accountingEntity.id,
        type: ELedgerType.Asset,
        subType: EAssetSubType.CashAndCashEquivalent,
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
      code: code as TCashLedgerCode,
      materializedPath,
      normalBalance: getLedgerAccountNormalBalance(ELedgerType.Asset),
      type: ELedgerType.Asset,
      subType: EAssetSubType.CashAndCashEquivalent,
      behavior: EAssetAccountBehavior.PettyCash,
      isControlAccount: payload.isControlAccount,
      controlAccountId: controlAccount.id,
      currency: payload.currency,
      meta: null,
      openingBalanceDate: payload.openingBalanceDate,
      status: payload.status ?? ELedgerAccountStatus.Active,
      contraAccountRule: EContraAccountRule.ContraPermitted,
      adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
      createdBy: payload.createdBy,
    });
  };
}

function updatePettyCashSubAccount(
  account: Parameters<ICashAccountService['updatePettyCashSubAccount']>[0],
  payload: Parameters<ICashAccountService['updatePettyCashSubAccount']>[1]
): ReturnType<ICashAccountService['updatePettyCashSubAccount']> {
  const isPettyCashAccount =
    account.type === ELedgerType.Asset &&
    account.subType === EAssetSubType.CashAndCashEquivalent &&
    account.behavior === EAssetAccountBehavior.PettyCash;
  if (!isPettyCashAccount) {
    throw new ledgerAccountError.InvalidBehavior({
      expected: EAssetAccountBehavior.PettyCash,
      received: account.behavior,
    });
  }
  if (account.status === ELedgerAccountStatus.Archived) {
    throw new ledgerAccountError.InvalidStatus({ status: account.status });
  }

  return ledgerAccountEntity.update(account as IPettyCashAccount, payload);
}

/**
 *
 * Normalizes bank details, enforces persisted-state invariants, and creates a complete bank account.
 * The caller holds allocation and parent locks through insertion and commit.
 *
 * @returns Audited ICashAndCashEquivalentAccount
 *
 */
function makeCreateBankSubAccount(
  deps: IDependencies
): ICashAccountService['createBankSubAccount'] {
  return async (payload, repoOptions) => {
    if (!repoOptions.tx)
      throw new ledgerAccountError.BankCreationTransactionRequired();

    const bankDetails = bankDetailsValue.make(payload.bankDetails);
    const existing = await deps.bankAccountRepo.findOne(
      bankDetails.bankName,
      bankDetails.accountNumber,
      repoOptions
    );
    if (existing)
      throw new ledgerAccountError.DuplicateBankAccount({
        details: bankDetails,
      });

    const controlAccount = await getLockedControlAccountHelper(
      deps.ledgerAccountRepo,
      {
        accountingEntityId: payload.accountingEntity.id,
        allocationHeaderCode: LEDGER_CODE.HEADER,
        defaultControlAccountCode: LEDGER_CODE.HEADER,
        controlAccountId: payload.controlAccountId,
      },
      repoOptions
    );

    controlAccountAvailabilityValidation.validate(controlAccount);

    cashControlAccountValidation.validate(
      controlAccount,
      payload.accountingEntity.id,
      EAssetAccountBehavior.Bank
    );
    ledgerAccountCurrencyInvarianceRule.validate({
      controlAccount,
      subAccountCurrency: payload.currency,
    });
    const code = await deps.ledgerCodeAllocationService.getNextCode(
      {
        accountingEntityId: payload.accountingEntity.id,
        type: ELedgerType.Asset,
        subType: EAssetSubType.CashAndCashEquivalent,
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
      code: code as TCashLedgerCode,
      materializedPath,
      normalBalance: getLedgerAccountNormalBalance(ELedgerType.Asset),
      type: ELedgerType.Asset,
      subType: EAssetSubType.CashAndCashEquivalent,
      behavior: EAssetAccountBehavior.Bank,
      isControlAccount: payload.isControlAccount,
      controlAccountId: controlAccount.id,
      currency: payload.currency,
      meta: bankDetails,
      openingBalanceDate: payload.openingBalanceDate,
      status: payload.status ?? ELedgerAccountStatus.Active,
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
    createPettyCashSubAccount: makeCreatePettyCashSubAccount(deps),
    updatePettyCashSubAccount,
    createBankSubAccount: makeCreateBankSubAccount(deps),
  };

  return Object.freeze(service);
}
