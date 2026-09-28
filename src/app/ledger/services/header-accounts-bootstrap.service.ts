import { TAuditedEntity } from '@shared/values/events/types/event.types';

import { IAssetDisposalLossAccountService } from '@domain/ledger/types/asset-disposal-loss.service.types';
import { IBankChargeAccountService } from '@domain/ledger/types/bank-charge.service.types';
import ICashAccountService from '@domain/ledger/types/cash-account.service.types';
import { IDirectCostsAccountService } from '@domain/ledger/types/direct-costs.service.types';
import { IEmploymentIncomeAccountService } from '@domain/ledger/types/employment-income.service.types';
import { IEquityAccountService } from '@domain/ledger/types/equity-account.service.types';
import { IFinanceCostAccountService } from '@domain/ledger/types/finance-cost.service.types';
import { IGainOnAssetSaleAccountService } from '@domain/ledger/types/gain-on-sale.service.types';
import { IGiftsAccountService } from '@domain/ledger/types/gifts.service.types';
import { IGrantsAccountService } from '@domain/ledger/types/grants.service.types';
import { IInterestAccountService } from '@domain/ledger/types/interest.service.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { IPayablesAccountService } from '@domain/ledger/types/payables.service.types';
import { IReceivablesAccountService } from '@domain/ledger/types/receivables-account.service.types';
import { IRentAndUtilitiesAccountService } from '@domain/ledger/types/rent-and-utilities.service.types';
import { IServicesAccountService } from '@domain/ledger/types/services.service.types';
import { IShortTermLoanAccountService } from '@domain/ledger/types/short-term-loan.service.types';
import { ITaxExpenseAccountService } from '@domain/ledger/types/tax-expense.service.types';
import { IUnrealizedGainAccountService } from '@domain/ledger/types/unrealized-gain.service.types';
import { IUnrealizedLossAccountService } from '@domain/ledger/types/unrealized-loss.service.types';

import IHeaderAccountsBootstrapService from '@app/ledger/contracts/header-accounts-bootstrap.service.contract';
import { ILedgerAccountBootstrapResult } from '@app/ledger/contracts/ledger-account-bootstrap.types';

interface IDependencies {
  cashAccountService: ICashAccountService;
  receivablesAccountService: IReceivablesAccountService;
  shortTermLoanAccountService: IShortTermLoanAccountService;
  payablesAccountService: IPayablesAccountService;
  equityAccountService: IEquityAccountService;
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

function appendAccount(
  bootstrap: ILedgerAccountBootstrapResult,
  [account, events, audit]: TAuditedLedgerAccount
) {
  bootstrap.entries.push({ account, audit });
  bootstrap.events.push(...events);
}

/**
 *
 * @param deprecated: setup should be done from API level
 */
export default function makeHeaderAccountsBootstrapService(
  deps: IDependencies
): IHeaderAccountsBootstrapService {
  const bootstrap: IHeaderAccountsBootstrapService['bootstrap'] = async (
    accountingEntity,
    createdBy,
    repoOptions
  ) => {
    const bootstrapResult: ILedgerAccountBootstrapResult = {
      entries: [],
      events: [],
    };

    // ========================================================================
    // ASSET LEDGER ACCOUNTS
    // ========================================================================

    appendAccount(
      bootstrapResult,
      await deps.cashAccountService.createHeader(
        {
          name: 'Cash and Cash Equivalents',
          createdBy,
          accountingEntity,
        },
        repoOptions
      )
    );
    appendAccount(
      bootstrapResult,
      await deps.receivablesAccountService.createHeader(
        {
          name: 'Receivables',
          createdBy,
          accountingEntity,
        },
        repoOptions
      )
    );

    // ========================================================================
    // LIABILITY LEDGER ACCOUNTS
    // ========================================================================

    appendAccount(
      bootstrapResult,
      await deps.shortTermLoanAccountService.createHeader(
        {
          name: 'Short Term Debt',
          createdBy,
          accountingEntity,
        },
        repoOptions
      )
    );
    appendAccount(
      bootstrapResult,
      await deps.payablesAccountService.createHeader(
        { name: 'Payables', createdBy, accountingEntity },
        repoOptions
      )
    );

    // ========================================================================
    // EQUITY LEDGER ACCOUNTS
    // ========================================================================

    appendAccount(
      bootstrapResult,
      await deps.equityAccountService.createRetainedEarningsAccount(
        { name: 'Retained Earnings', createdBy, accountingEntity },
        repoOptions
      )
    );
    appendAccount(
      bootstrapResult,
      await deps.equityAccountService.createOpeningBalanceAccount(
        { name: 'Opening Balance Equity', createdBy, accountingEntity },
        repoOptions
      )
    );

    // ========================================================================
    // REVENUE LEDGER ACCOUNTS
    // ========================================================================

    const revenueHeaderPayload = { createdBy, accountingEntity };
    appendAccount(
      bootstrapResult,
      await deps.servicesAccountService.createHeader(
        { ...revenueHeaderPayload, name: 'Services' },
        repoOptions
      )
    );
    appendAccount(
      bootstrapResult,
      await deps.employmentIncomeAccountService.createHeader(
        { ...revenueHeaderPayload, name: 'Employment Income' },
        repoOptions
      )
    );
    appendAccount(
      bootstrapResult,
      await deps.gainOnAssetSaleAccountService.createHeader(
        { ...revenueHeaderPayload, name: 'Gain on Sale of Assets' },
        repoOptions
      )
    );
    appendAccount(
      bootstrapResult,
      await deps.unrealizedGainAccountService.createHeader(
        { ...revenueHeaderPayload, name: 'Unrealized Gain' },
        repoOptions
      )
    );
    appendAccount(
      bootstrapResult,
      await deps.grantsAccountService.createHeader(
        { ...revenueHeaderPayload, name: 'Grants' },
        repoOptions
      )
    );
    appendAccount(
      bootstrapResult,
      await deps.giftsAccountService.createHeader(
        { ...revenueHeaderPayload, name: 'Gifts' },
        repoOptions
      )
    );

    // ========================================================================
    // EXPENSE LEDGER ACCOUNTS
    // ========================================================================

    const expenseHeaderPayload = { createdBy, accountingEntity };
    appendAccount(
      bootstrapResult,
      await deps.directCostsAccountService.createHeader(
        {
          ...expenseHeaderPayload,
          name: 'Direct Costs',
        },
        repoOptions
      )
    );
    appendAccount(
      bootstrapResult,
      await deps.rentAndUtilitiesAccountService.createHeader(
        { ...expenseHeaderPayload, name: 'Rent and Utilities' },
        repoOptions
      )
    );
    appendAccount(
      bootstrapResult,
      await deps.bankChargeAccountService.createHeader(
        { ...expenseHeaderPayload, name: 'Bank Charge' },
        repoOptions
      )
    );
    appendAccount(
      bootstrapResult,
      await deps.financeCostAccountService.createHeader(
        { ...expenseHeaderPayload, name: 'Finance Cost' },
        repoOptions
      )
    );
    appendAccount(
      bootstrapResult,
      await deps.interestAccountService.createHeader(
        { ...expenseHeaderPayload, name: 'Interest' },
        repoOptions
      )
    );
    appendAccount(
      bootstrapResult,
      await deps.taxExpenseAccountService.createHeader(
        { ...expenseHeaderPayload, name: 'Tax Expense' },
        repoOptions
      )
    );
    appendAccount(
      bootstrapResult,
      await deps.unrealizedLossAccountService.createHeader(
        { ...expenseHeaderPayload, name: 'Unrealized Loss' },
        repoOptions
      )
    );
    appendAccount(
      bootstrapResult,
      await deps.assetDisposalLossAccountService.createHeader(
        { ...expenseHeaderPayload, name: 'Asset Disposal Loss' },
        repoOptions
      )
    );

    return Object.freeze(bootstrapResult);
  };

  return Object.freeze({ bootstrap });
}
