import { TEntityId } from '@shared/types/uuid';
import { TAuditedEntity } from '@shared/values/events/types/event.types';
import historyValue from '@shared/values/history/history.vo';

import { ASSET_LEDGER_CODES } from '@domain/ledger/config/asset-codes.config';
import { EXPENSE_LEDGER_CODES } from '@domain/ledger/config/expense-codes.config';
import { LIABILITY_LEDGER_CODES } from '@domain/ledger/config/liability-codes.config';
import { REVENUE_LEDGER_CODES } from '@domain/ledger/config/revenue-codes.config';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import { IAssetDisposalLossAccountService } from '@domain/ledger/types/asset-disposal-loss.service.types';
import { IBankChargeAccountService } from '@domain/ledger/types/bank-charge.service.types';
import { IDirectCostsAccountService } from '@domain/ledger/types/direct-costs.service.types';
import { IEmploymentIncomeAccountService } from '@domain/ledger/types/employment-income.service.types';
import { EExpenseAccountBehavior } from '@domain/ledger/types/expense-account.types';
import { IFinanceCostAccountService } from '@domain/ledger/types/finance-cost.service.types';
import { IGainOnAssetSaleAccountService } from '@domain/ledger/types/gain-on-sale.service.types';
import { IGiftsAccountService } from '@domain/ledger/types/gifts.service.types';
import { IGrantsAccountService } from '@domain/ledger/types/grants.service.types';
import { IInterestAccountService } from '@domain/ledger/types/interest.service.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import {
  IStatutoryPayableAccountMeta,
  ITradePayableAccountMeta,
} from '@domain/ledger/types/liability-account.types';
import { IPayablesAccountService } from '@domain/ledger/types/payables.service.types';
import { IReceivablesAccountService } from '@domain/ledger/types/receivables-account.service.types';
import { IRentAndUtilitiesAccountService } from '@domain/ledger/types/rent-and-utilities.service.types';
import { IServicesAccountService } from '@domain/ledger/types/services.service.types';
import { ITaxExpenseAccountService } from '@domain/ledger/types/tax-expense.service.types';
import { IUnrealizedGainAccountService } from '@domain/ledger/types/unrealized-gain.service.types';
import { IUnrealizedLossAccountService } from '@domain/ledger/types/unrealized-loss.service.types';
import currencyEntity from '@domain/money/entities/currency.entity';

import { ILedgerAccountBootstrapResult } from '@app/ledger/contracts/ledger-account-bootstrap.types';
import ILedgerAccountPersistenceService from '@app/ledger/contracts/ledger-account-persistence.service.contract';
import IPostingAccountBootstrapService from '@app/ledger/contracts/posting-account-bootstrap.service.contract';

interface IDependencies {
  ledgerAccountRepo: ILedgerAccountRepo;
  ledgerAccountPersistenceService: ILedgerAccountPersistenceService;
  receivablesAccountService: IReceivablesAccountService;
  payablesAccountService: IPayablesAccountService;
  servicesAccountService: IServicesAccountService;
  employmentIncomeAccountService: IEmploymentIncomeAccountService;
  gainOnAssetSaleAccountService: IGainOnAssetSaleAccountService;
  unrealizedGainAccountService: IUnrealizedGainAccountService;
  grantsAccountService: IGrantsAccountService;
  giftsAccountService: IGiftsAccountService;
  directCostsAccountService: IDirectCostsAccountService;
  rentAndUtilitiesAccountService: IRentAndUtilitiesAccountService;
  bankChargeAccountService: IBankChargeAccountService;
  financeCostAccountService: IFinanceCostAccountService;
  interestAccountService: IInterestAccountService;
  taxExpenseAccountService: ITaxExpenseAccountService;
  unrealizedLossAccountService: IUnrealizedLossAccountService;
  assetDisposalLossAccountService: IAssetDisposalLossAccountService;
}

type TAuditedLedgerAccount = TAuditedEntity<
  ILedgerAccount,
  ILedgerAccount,
  ILedgerAccount
>;

export default function makePostingAccountBootstrapService(
  deps: IDependencies
): IPostingAccountBootstrapService {
  const bootstrap: IPostingAccountBootstrapService['bootstrap'] = async (
    accountingEntity,
    createdBy,
    repoOptions
  ) => {
    const accountingEntityId = accountingEntity.id;
    const functionalCurrency = currencyEntity.getByCode(
      accountingEntity.functionalCurrencyCode
    );
    const actor = createdBy;
    const bootstrapResult: ILedgerAccountBootstrapResult = {
      entries: [],
      events: [],
    };
    const getControlAccount = async (code: string) => {
      const controlAccount = await deps.ledgerAccountRepo.findByCode(
        code,
        accountingEntityId,
        repoOptions
      );
      if (!controlAccount) {
        throw new ledgerAccountError.ControlAccountNotFound({
          controlAccountLedgerCode: code,
        });
      }
      return controlAccount;
    };
    const postingPayload = {
      createdBy,
      accountingEntityId,
      isControlAccount: false,
    };
    const persistAccount = async ([
      account,
      events,
      audit,
    ]: TAuditedLedgerAccount) => {
      const history = historyValue.make(
        audit,
        actor,
        repoOptions.correlationId
      );

      await deps.ledgerAccountPersistenceService.createWithoutAssigningCode(
        account,
        accountingEntity.functionalCurrencyCode,
        { ...repoOptions, history: [history] }
      );

      bootstrapResult.entries.push({ account, audit });
      bootstrapResult.events.push(...events);
    };

    // ========================================================================
    // ASSET LEDGER POSTING ACCOUNTS
    // ========================================================================

    await persistAccount(
      deps.receivablesAccountService.createTradeReceivableSubAccount({
        name: 'Trade Receivables',
        createdBy,
        accountingEntity,
        currency: functionalCurrency,
        isControlAccount: true,
        controlAccount: await getControlAccount(
          ASSET_LEDGER_CODES.RECEIVABLES.HEADER
        ),
      })
    );
    await persistAccount(
      deps.receivablesAccountService.createStatutoryReceivableSubAccount({
        name: 'Statutory Receivables',
        createdBy,
        accountingEntity,
        currency: functionalCurrency,
        isControlAccount: true,
        controlAccount: await getControlAccount(
          ASSET_LEDGER_CODES.RECEIVABLES.HEADER
        ),
      })
    );
    await persistAccount(
      deps.receivablesAccountService.createStatutoryReceivableSubAccount({
        name: 'Statutory Receivables (Default)',
        createdBy,
        accountingEntity,
        currency: functionalCurrency,
        isControlAccount: false,
        controlAccount: await getControlAccount(
          ASSET_LEDGER_CODES.RECEIVABLES.STATUTORY
        ),
      })
    );

    // ========================================================================
    // LIABILITY LEDGER POSTING ACCOUNTS
    // ========================================================================

    await persistAccount(
      deps.payablesAccountService.createTradePayableSubAccount({
        name: 'Trade Payables',
        createdBy,
        accountingEntity,
        isControlAccount: true,
        controlAccount: await getControlAccount(
          LIABILITY_LEDGER_CODES.PAYABLES.HEADER
        ),
        meta: null as unknown as ITradePayableAccountMeta,
      })
    );
    await persistAccount(
      deps.payablesAccountService.createStatutoryPayableSubAccount({
        name: 'Statutory Payables',
        createdBy,
        accountingEntity,
        currency: functionalCurrency,
        isControlAccount: true,
        controlAccount: await getControlAccount(
          LIABILITY_LEDGER_CODES.PAYABLES.HEADER
        ),
        meta: null as unknown as IStatutoryPayableAccountMeta,
      })
    );
    await persistAccount(
      deps.payablesAccountService.createStatutoryPayableSubAccount({
        name: 'Statutory Payables (Default)',
        createdBy,
        accountingEntity,
        currency: functionalCurrency,
        isControlAccount: false,
        controlAccount: await getControlAccount(
          LIABILITY_LEDGER_CODES.PAYABLES.STATUTORY
        ),
        meta: null as unknown as IStatutoryPayableAccountMeta,
      })
    );

    // ========================================================================
    // REVENUE LEDGER POSTING ACCOUNTS
    // ========================================================================

    await persistAccount(
      deps.servicesAccountService.createSubAccount({
        ...postingPayload,
        name: 'Services (Default)',
        controlAccount: await getControlAccount(
          REVENUE_LEDGER_CODES.SERVICES.HEADER
        ),
      })
    );
    await persistAccount(
      deps.employmentIncomeAccountService.createSubAccount({
        ...postingPayload,
        name: 'Employment Income (Default)',
        controlAccount: await getControlAccount(
          REVENUE_LEDGER_CODES.EMPLOYMENT_INCOME.HEADER
        ),
      })
    );
    await persistAccount(
      deps.gainOnAssetSaleAccountService.createSubAccount({
        ...postingPayload,
        name: 'Gain on Sale of Assets (Default)',
        controlAccount: await getControlAccount(
          REVENUE_LEDGER_CODES.GAIN_ON_ASSET_SALE.HEADER
        ),
      })
    );
    await persistAccount(
      deps.unrealizedGainAccountService.createSubAccount({
        ...postingPayload,
        name: 'Unrealized Gains (Default)',
        controlAccount: await getControlAccount(
          REVENUE_LEDGER_CODES.UNREALIZED_GAINS.HEADER
        ),
      })
    );
    await persistAccount(
      deps.grantsAccountService.createSubAccount({
        ...postingPayload,
        name: 'Grants (Default)',
        controlAccount: await getControlAccount(
          REVENUE_LEDGER_CODES.GRANTS.HEADER
        ),
      })
    );
    await persistAccount(
      deps.giftsAccountService.createSubAccount({
        ...postingPayload,
        name: 'Gifts (Default)',
        controlAccount: await getControlAccount(
          REVENUE_LEDGER_CODES.GIFTS.HEADER
        ),
      })
    );

    // ========================================================================
    // EXPENSE LEDGER POSTING ACCOUNTS
    // ========================================================================

    await persistAccount(
      deps.directCostsAccountService.createSubAccount({
        ...postingPayload,
        name: 'Direct Costs (Default)',
        behavior: EExpenseAccountBehavior.DefaultDirectCost,
        controlAccount: await getControlAccount(
          EXPENSE_LEDGER_CODES.DIRECT_COSTS.HEADER
        ),
      })
    );
    await persistAccount(
      deps.rentAndUtilitiesAccountService.createSubAccount({
        ...postingPayload,
        name: 'Rent and Utilities (Default)',
        controlAccount: await getControlAccount(
          EXPENSE_LEDGER_CODES.RENT_AND_UTILITIES.HEADER
        ),
      })
    );
    await persistAccount(
      deps.bankChargeAccountService.createSubAccount({
        ...postingPayload,
        name: 'Bank Charge (Default)',
        controlAccount: await getControlAccount(
          EXPENSE_LEDGER_CODES.BANK_CHARGE.HEADER
        ),
      })
    );
    await persistAccount(
      deps.financeCostAccountService.createSubAccount({
        ...postingPayload,
        name: 'Finance Cost (Default)',
        controlAccount: await getControlAccount(
          EXPENSE_LEDGER_CODES.FINANCE_COST.HEADER
        ),
      })
    );
    await persistAccount(
      deps.interestAccountService.createSubAccount({
        ...postingPayload,
        name: 'Interest (Default)',
        controlAccount: await getControlAccount(
          EXPENSE_LEDGER_CODES.INTEREST.HEADER
        ),
      })
    );
    await persistAccount(
      deps.taxExpenseAccountService.createSubAccount({
        ...postingPayload,
        name: 'Tax Expense (Default)',
        controlAccount: await getControlAccount(
          EXPENSE_LEDGER_CODES.TAX_EXPENSE.HEADER
        ),
      })
    );
    await persistAccount(
      deps.unrealizedLossAccountService.createSubAccount({
        ...postingPayload,
        name: 'Unrealized Loss (Default)',
        controlAccount: await getControlAccount(
          EXPENSE_LEDGER_CODES.UNREALIZED_LOSS.HEADER
        ),
      })
    );
    await persistAccount(
      deps.assetDisposalLossAccountService.createSubAccount({
        ...postingPayload,
        name: 'Asset Disposal Loss (Default)',
        controlAccount: await getControlAccount(
          EXPENSE_LEDGER_CODES.ASSET_DISPOSAL_LOSS.HEADER
        ),
      })
    );

    return Object.freeze(bootstrapResult);
  };

  return Object.freeze({ bootstrap });
}
