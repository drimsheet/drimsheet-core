import { ERepoLock } from '@shared/types/repo.types';

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
import controlAccountChildStatusValidation from '@domain/ledger/services/validations/control-account-child-status.validation';
import {
  EAssetAccountBehavior,
  EAssetSubType,
  IBankAccount,
  ICashAndCashEquivalentAccount,
  IPettyCashAccount,
} from '@domain/ledger/types/asset-account.types';
import ICashAccountService from '@domain/ledger/types/cash-account.service.types';
import ILedgerAccountService from '@domain/ledger/types/ledger-account.service.types';
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
  ledgerAccountService: ILedgerAccountService;
}

const LEDGER_CODE = ASSET_LEDGER_CODES.CASH_AND_EQUIVALENTS;

/** Activates a draft cash account beneath an active parent, returning state, events and audit without writes. */
function makeActivate(deps: IDependencies): ICashAccountService['activate'] {
  return async (account, repoOptions) => {
    const isCashAccount =
      account.type === ELedgerType.Asset &&
      account.subType === EAssetSubType.CashAndCashEquivalent;

    if (!isCashAccount) {
      throw new ledgerAccountError.InvalidBehavior({
        behavior: account.behavior,
      });
    }
    if (!account.controlAccountId) {
      throw new ledgerAccountError.InvalidControlAccountId();
    }

    const controlAccount = await deps.ledgerAccountRepo.findById(
      account.controlAccountId,
      account.accountingEntityId,
      repoOptions
    );
    if (!controlAccount) {
      throw new ledgerAccountError.ControlAccountNotFound();
    }
    controlAccountAvailabilityValidation.validate(controlAccount);
    controlAccountChildStatusValidation.validate(
      controlAccount.status,
      ELedgerAccountStatus.Active
    );

    return ledgerAccountEntity.activate(account);
  };
}

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

    return ledgerAccountEntity.make<ICashAndCashEquivalentAccount>({
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
    if (!repoOptions.tx) {
      throw new ledgerAccountError.CodeAllocationTransactionRequired();
    }

    const selectedControlAccount = await getLockedControlAccountHelper(
      deps.ledgerAccountRepo,
      {
        accountingEntityId: payload.accountingEntity.id,
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

    cashControlAccountValidation.validate(
      selectedControlAccount,
      payload.accountingEntity.id,
      EAssetAccountBehavior.PettyCash
    );

    ledgerAccountCurrencyInvarianceRule.validate({
      controlAccount: selectedControlAccount,
      subAccountCurrency: payload.currency,
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
        accountingEntityId: payload.accountingEntity.id,
        type: ELedgerType.Asset,
        subType: EAssetSubType.CashAndCashEquivalent,
        allocationHeaderCode: LEDGER_CODE.HEADER,
        reservedCode: promotion?.postingAccount[0].code,
      },
      repoOptions
    );

    const materializedPath = getLedgerAccountMaterializedPath(
      controlAccount.materializedPath,
      code
    );

    const auditedAccount =
      ledgerAccountEntity.make<ICashAndCashEquivalentAccount>({
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
        status,
        contraAccountRule: EContraAccountRule.ContraPermitted,
        adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
        createdBy: payload.createdBy,
      });
    return promotion ? [...auditedAccount, promotion] : auditedAccount;
  };
}

/** Updates petty cash details after checking journal references and hierarchy for a currency change. */
function makeUpdatePettyCashSubAccount(
  deps: IDependencies
): ICashAccountService['updatePettyCashSubAccount'] {
  return async (payload, repoOptions) => {
    // Match child creation's family-before-account lock order during currency edits.
    if (payload.currency) {
      if (!repoOptions.tx) {
        throw new ledgerAccountError.CurrencyChangeTransactionRequired();
      }
      await getLockedControlAccountHelper(
        deps.ledgerAccountRepo,
        {
          accountingEntityId: payload.accountingEntityId,
          allocationHeaderCode: LEDGER_CODE.HEADER,
          defaultControlAccountCode: LEDGER_CODE.HEADER,
        },
        { ...repoOptions, tx: repoOptions.tx }
      );
    }

    // Serialize account updates and opening-journal preparation until commit.
    const account = await deps.ledgerAccountRepo.findById(
      payload.id,
      payload.accountingEntityId,
      { ...repoOptions, lock: ERepoLock.Update }
    );
    if (!account) {
      throw new ledgerAccountError.AccountNotFound({ id: payload.id });
    }

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

    await deps.ledgerAccountService.validateCurrencyChange(
      account,
      payload.currency,
      repoOptions
    );
    return ledgerAccountEntity.update(account as IPettyCashAccount, {
      name: payload.name,
      currency: payload.currency,
      openingBalanceDate: payload.openingBalanceDate,
    });
  };
}

/** Normalizes bank details and checks changed identities for duplicates; rejects other families and archived accounts without writing. */
function makeUpdateBankSubAccount(
  deps: IDependencies
): ICashAccountService['updateBankSubAccount'] {
  return async (payload, repoOptions) => {
    // Match child creation's family-before-account lock order during currency edits.
    if (payload.currency) {
      if (!repoOptions.tx) {
        throw new ledgerAccountError.CurrencyChangeTransactionRequired();
      }
      await getLockedControlAccountHelper(
        deps.ledgerAccountRepo,
        {
          accountingEntityId: payload.accountingEntityId,
          allocationHeaderCode: LEDGER_CODE.HEADER,
          defaultControlAccountCode: LEDGER_CODE.HEADER,
        },
        { ...repoOptions, tx: repoOptions.tx }
      );
    }

    // Serialize account updates and opening-journal preparation until commit.
    const account = await deps.ledgerAccountRepo.findById(
      payload.id,
      payload.accountingEntityId,
      { ...repoOptions, lock: ERepoLock.Update }
    );
    if (!account) {
      throw new ledgerAccountError.AccountNotFound({ id: payload.id });
    }

    const isBankAccount =
      account.type === ELedgerType.Asset &&
      account.subType === EAssetSubType.CashAndCashEquivalent &&
      account.behavior === EAssetAccountBehavior.Bank;
    if (!isBankAccount) {
      throw new ledgerAccountError.InvalidBehavior({
        expected: EAssetAccountBehavior.Bank,
        received: account.behavior,
      });
    }
    if (account.status === ELedgerAccountStatus.Archived) {
      throw new ledgerAccountError.InvalidStatus({ status: account.status });
    }

    await deps.ledgerAccountService.validateCurrencyChange(
      account,
      payload.currency,
      repoOptions
    );

    const bankAccount = account as IBankAccount;
    const bankDetails = payload.bankDetails
      ? bankDetailsValue.make({
          countryCode: bankAccount.meta.countryCode,
          bankName: payload.bankDetails.bankName,
          accountName: payload.bankDetails.accountName,
          accountNumber: payload.bankDetails.accountNumber,
        })
      : bankAccount.meta;
    const hasIdentityChanged =
      bankDetails.bankName !== bankAccount.meta.bankName ||
      bankDetails.accountNumber !== bankAccount.meta.accountNumber;
    if (hasIdentityChanged) {
      const existingBank = await deps.bankAccountRepo.findOne(
        bankDetails.bankName,
        bankDetails.accountNumber,
        repoOptions
      );
      if (existingBank) {
        throw new ledgerAccountError.DuplicateBankAccount({
          details: bankDetails,
        });
      }
    }

    return ledgerAccountEntity.update(bankAccount, {
      name: payload.name,
      currency: payload.currency,
      openingBalanceDate: payload.openingBalanceDate,
      meta: bankDetails,
    });
  };
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
    if (!repoOptions.tx) {
      throw new ledgerAccountError.BankCreationTransactionRequired();
    }

    const bankDetails = bankDetailsValue.make(payload.bankDetails);
    const existing = await deps.bankAccountRepo.findOne(
      bankDetails.bankName,
      bankDetails.accountNumber,
      repoOptions
    );
    if (existing) {
      throw new ledgerAccountError.DuplicateBankAccount({
        details: bankDetails,
      });
    }

    const selectedControlAccount = await getLockedControlAccountHelper(
      deps.ledgerAccountRepo,
      {
        accountingEntityId: payload.accountingEntity.id,
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

    cashControlAccountValidation.validate(
      selectedControlAccount,
      payload.accountingEntity.id,
      EAssetAccountBehavior.Bank
    );
    ledgerAccountCurrencyInvarianceRule.validate({
      controlAccount: selectedControlAccount,
      subAccountCurrency: payload.currency,
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
        accountingEntityId: payload.accountingEntity.id,
        type: ELedgerType.Asset,
        subType: EAssetSubType.CashAndCashEquivalent,
        allocationHeaderCode: LEDGER_CODE.HEADER,
        reservedCode: promotion?.postingAccount[0].code,
      },
      repoOptions
    );

    const materializedPath = getLedgerAccountMaterializedPath(
      controlAccount.materializedPath,
      code
    );

    const auditedAccount =
      ledgerAccountEntity.make<ICashAndCashEquivalentAccount>({
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
        status,
        contraAccountRule: EContraAccountRule.ContraPermitted,
        adjunctAccountRule: EAdjunctAccountRule.AdjunctPermitted,
        createdBy: payload.createdBy,
      });
    return promotion ? [...auditedAccount, promotion] : auditedAccount;
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
    activate: makeActivate(deps),
    createHeader: makeCreateHeader(deps),
    createPettyCashSubAccount: makeCreatePettyCashSubAccount(deps),
    updatePettyCashSubAccount: makeUpdatePettyCashSubAccount(deps),
    updateBankSubAccount: makeUpdateBankSubAccount(deps),
    createBankSubAccount: makeCreateBankSubAccount(deps),
  };

  return Object.freeze(service);
}
