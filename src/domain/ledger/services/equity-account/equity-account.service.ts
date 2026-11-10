import { EQUITY_LEDGER_CODES } from '@domain/ledger/config/equity-codes.config';
import getLedgerAccountNormalBalanceHelper from '@domain/ledger/entities/helpers/get-normal-balance.helper';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import { IEquityAccountService } from '@domain/ledger/types/equity-account.service.types';
import {
  EEquityAccountBehavior,
  EEquitySubType,
} from '@domain/ledger/types/equity-account.types';
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

/**
 *
 * Creates a new opening balance equity account
 *
 * @returns Audited IOpeningBalanceEquityAccount
 *
 */
function makeCreateOpeningBalanceAccount(
  deps: IDependencies
): IEquityAccountService['createOpeningBalanceAccount'] {
  return async (payload, repoOptions) => {
    const existing = await deps.ledgerAccountRepo.findByCode(
      EQUITY_LEDGER_CODES.OPENING_BALANCE_EQUITY,
      payload.accountingEntity.id,
      repoOptions
    );

    if (existing) {
      throw new ledgerAccountError.OpeningBalanceAccountAlreadyExists({
        existing,
      });
    }

    const currency = currencyEntity.getByCode(
      payload.accountingEntity.functionalCurrencyCode
    );

    return ledgerAccountEntity.make({
      name: payload.name,
      accountingEntityId: payload.accountingEntity.id,
      code: EQUITY_LEDGER_CODES.OPENING_BALANCE_EQUITY,
      materializedPath: EQUITY_LEDGER_CODES.OPENING_BALANCE_EQUITY,
      normalBalance: getLedgerAccountNormalBalanceHelper(ELedgerType.Equity),
      type: ELedgerType.Equity,
      subType: EEquitySubType.OpeningBalance,
      behavior: EEquityAccountBehavior.OpeningBalanceEquity,
      isControlAccount: false,
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

function makeCreateRetainedEarningsAccount(
  deps: IDependencies
): IEquityAccountService['createRetainedEarningsAccount'] {
  return async (payload, repoOptions) => {
    const existing = await deps.ledgerAccountRepo.findByCode(
      EQUITY_LEDGER_CODES.RETAINED_EARNINGS,
      payload.accountingEntity.id,
      repoOptions
    );

    if (existing) {
      throw new ledgerAccountError.RetainedEarningsAccountAlreadyExists({
        existing,
      });
    }

    const currency = currencyEntity.getByCode(
      payload.accountingEntity.functionalCurrencyCode
    );

    return ledgerAccountEntity.make({
      name: payload.name,
      accountingEntityId: payload.accountingEntity.id,
      code: EQUITY_LEDGER_CODES.RETAINED_EARNINGS,
      materializedPath: EQUITY_LEDGER_CODES.RETAINED_EARNINGS,
      normalBalance: getLedgerAccountNormalBalanceHelper(ELedgerType.Equity),
      type: ELedgerType.Equity,
      subType: EEquitySubType.RetainedEarnings,
      behavior: EEquityAccountBehavior.RetainedEarnings,
      isControlAccount: false,
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

export default function makeEquityAccountService(deps: IDependencies) {
  const service: IEquityAccountService = {
    createOpeningBalanceAccount: makeCreateOpeningBalanceAccount(deps),
    createRetainedEarningsAccount: makeCreateRetainedEarningsAccount(deps),
  };

  return Object.freeze(service);
}
