import IEventBus from '@shared/contracts/event-bus.contract';
import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import { TAuditedEntity } from '@shared/values/events/types/event.types';
import historyValue from '@shared/values/history/history.vo';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
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
import currencyEntity from '@domain/money/entities/currency.entity';

import IAppContext from '@app/context/contracts/app-context.contract';
import ILedgerAccountPersistenceService, {
  IAssignedLedgerAccount,
} from '@app/ledger/contracts/ledger-account-persistence.service.contract';
import { IHeaderAccountNameAliasesReq } from '@app/ledger/dtos/header-account/header-account.dto';
import { headerAccountNameAliasesReqValidation } from '@app/ledger/dtos/header-account/header-account.dto.validation';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import ledgerAccountToDtoMapperHelper from '@app/ledger/usecases/helpers/ledger-account-to-dto-mapper.helper';

interface IDependencies {
  appContext: IAppContext;
  eventBus: IEventBus;
  repoService: IRepoService;
  ledgerAccountPersistenceService: ILedgerAccountPersistenceService;
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

export default function makeSetupHeaderAccountsUsecase(deps: IDependencies) {
  return async (
    aliases: IHeaderAccountNameAliasesReq = {}
  ): Promise<ILedgerAccountDto[]> => {
    zodValidationRunner(headerAccountNameAliasesReqValidation, aliases);

    const { actor, accountingEntity, correlationId } = deps.appContext.get([
      'actor',
      'accountingEntity',
    ]);
    const repoOptions = { correlationId };
    const headerPayload = { accountingEntity, createdBy: actor.id };

    const auditedCashHeader = await deps.cashAccountService.createHeader(
      getCreationInput(aliases, 'cash_and_cash_equivalent', headerPayload),
      repoOptions
    );
    const auditedReceivablesHeader =
      await deps.receivablesAccountService.createHeader(
        getCreationInput(aliases, 'receivables', headerPayload),
        repoOptions
      );
    const auditedShortTermDebtHeader =
      await deps.shortTermLoanAccountService.createHeader(
        getCreationInput(aliases, 'short_term_debt', headerPayload),
        repoOptions
      );
    const auditedPayablesHeader =
      await deps.payablesAccountService.createHeader(
        getCreationInput(aliases, 'payable', headerPayload),
        repoOptions
      );
    const [receivablesHeader] = auditedReceivablesHeader;
    const [payablesHeader] = auditedPayablesHeader;

    const auditedAccounts: TAuditedEntity<
      ILedgerAccount,
      ILedgerAccount,
      ILedgerAccount
    >[] = [
      auditedCashHeader,
      auditedReceivablesHeader,
      auditedShortTermDebtHeader,
      auditedPayablesHeader,
      await deps.equityAccountService.createRetainedEarningsAccount(
        getCreationInput(aliases, 'retained_earnings', headerPayload),
        repoOptions
      ),
      await deps.equityAccountService.createOpeningBalanceAccount(
        getCreationInput(aliases, 'opening_balance', headerPayload),
        repoOptions
      ),
      await deps.servicesAccountService.createHeader(
        getCreationInput(aliases, 'services', headerPayload),
        repoOptions
      ),
      await deps.employmentIncomeAccountService.createHeader(
        getCreationInput(aliases, 'employment_income', headerPayload),
        repoOptions
      ),
      await deps.gainOnAssetSaleAccountService.createHeader(
        getCreationInput(aliases, 'gain_on_asset_sale', headerPayload),
        repoOptions
      ),
      await deps.unrealizedGainAccountService.createHeader(
        getCreationInput(aliases, 'unrealized_gains', headerPayload),
        repoOptions
      ),
      await deps.grantsAccountService.createHeader(
        getCreationInput(aliases, 'grants', headerPayload),
        repoOptions
      ),
      await deps.giftsAccountService.createHeader(
        getCreationInput(aliases, 'gifts', headerPayload),
        repoOptions
      ),
      await deps.directCostsAccountService.createHeader(
        getCreationInput(aliases, 'direct_costs', headerPayload),
        repoOptions
      ),
      await deps.rentAndUtilitiesAccountService.createHeader(
        getCreationInput(aliases, 'rent_and_utilities', headerPayload),
        repoOptions
      ),
      await deps.bankChargeAccountService.createHeader(
        getCreationInput(aliases, 'bank_charge', headerPayload),
        repoOptions
      ),
      await deps.financeCostAccountService.createHeader(
        getCreationInput(aliases, 'finance_cost', headerPayload),
        repoOptions
      ),
      await deps.interestAccountService.createHeader(
        getCreationInput(aliases, 'interest', headerPayload),
        repoOptions
      ),
      await deps.taxExpenseAccountService.createHeader(
        getCreationInput(aliases, 'income_tax_expense', headerPayload),
        repoOptions
      ),
      await deps.unrealizedLossAccountService.createHeader(
        getCreationInput(aliases, 'unrealized_loss', headerPayload),
        repoOptions
      ),
      await deps.assetDisposalLossAccountService.createHeader(
        getCreationInput(aliases, 'loss_on_asset_disposal', headerPayload),
        repoOptions
      ),
    ];

    const preparedAccounts = auditedAccounts.map(
      ([account, events, audit]) => ({
        account,
        events,
        history: historyValue.make(audit, actor.id, correlationId),
        dto: ledgerAccountToDtoMapperHelper(
          account,
          null,
          accountingEntity.functionalCurrencyCode
        ),
      })
    );

    const functionalCurrency = currencyEntity.getByCode(
      accountingEntity.functionalCurrencyCode
    );

    // Setup receivables control accounts
    const auditedTradeReceivableSubAccount =
      deps.receivablesAccountService.createTradeReceivableSubAccount({
        ...getCreationInput(aliases, 'trade_receivables', headerPayload),
        controlAccount: receivablesHeader,
        currency: functionalCurrency,
        isControlAccount: true,
      });

    const auditedStatutoryReceivablesSubAccount =
      deps.receivablesAccountService.createStatutoryReceivableSubAccount({
        ...getCreationInput(aliases, 'statutory_receivables', headerPayload),
        controlAccount: receivablesHeader,
        currency: functionalCurrency,
        isControlAccount: true,
      });

    // Setup payables control accounts
    const auditedTradePayableSubAccount =
      deps.payablesAccountService.createTradePayableSubAccount({
        ...getCreationInput(aliases, 'trade_payables', headerPayload),
        controlAccount: payablesHeader,
        isControlAccount: true,
        meta: null,
      });

    const auditedStatutoryPayablesSubAccount =
      deps.payablesAccountService.createStatutoryPayableSubAccount({
        ...getCreationInput(aliases, 'statutory_payables', headerPayload),
        controlAccount: payablesHeader,
        currency: functionalCurrency,
        isControlAccount: true,
        meta: null,
      });

    const auditedControls = [
      {
        allocationHeaderCode: receivablesHeader.code,
        auditedAccount: auditedTradeReceivableSubAccount,
      },
      {
        allocationHeaderCode: receivablesHeader.code,
        auditedAccount: auditedStatutoryReceivablesSubAccount,
      },
      {
        allocationHeaderCode: payablesHeader.code,
        auditedAccount: auditedTradePayableSubAccount,
      },
      {
        allocationHeaderCode: payablesHeader.code,
        auditedAccount: auditedStatutoryPayablesSubAccount,
      },
    ];

    const preparedControls = auditedControls.map((entry) => {
      const [account, events, audit] = entry.auditedAccount;
      return {
        account,
        events,
        allocationHeaderCode: entry.allocationHeaderCode,
        history: historyValue.make(audit, actor.id, correlationId),
      };
    });

    const transactionFn: TRepoTransactionFn<IAssignedLedgerAccount[]> = async (
      tx
    ) => {
      const writeRepoOptions = { ...repoOptions, tx };
      for (const entry of preparedAccounts) {
        await deps.ledgerAccountPersistenceService.createWithoutAssigningCode(
          entry.account,
          accountingEntity.functionalCurrencyCode,
          { ...writeRepoOptions, history: [entry.history] }
        );
      }

      // Allocation locks must see the persisted roots and each preceding sibling.
      const assignedControls: IAssignedLedgerAccount[] = [];
      for (const entry of preparedControls) {
        const assigned =
          await deps.ledgerAccountPersistenceService.createAndAssignCode(
            {
              account: entry.account,
              allocationHeaderCode: entry.allocationHeaderCode,
              actorId: actor.id,
            },
            accountingEntity.functionalCurrencyCode,
            { ...writeRepoOptions, history: [entry.history] }
          );
        assignedControls.push({
          account: assigned.account,
          events: [...entry.events, ...assigned.events],
        });
      }
      return assignedControls;
    };

    const assignedControls =
      await deps.repoService.runInTransaction(transactionFn);

    const events = [
      ...preparedAccounts.flatMap((entry) => entry.events),
      ...assignedControls.flatMap((entry) => entry.events),
    ];
    await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));

    return [
      ...preparedAccounts.map((entry) => entry.dto),
      ...assignedControls.map((entry) =>
        ledgerAccountToDtoMapperHelper(
          entry.account,
          null,
          accountingEntity.functionalCurrencyCode
        )
      ),
    ];
  };
}

/** Builds the domain creation input using an alias or the default English name. */
function getCreationInput(
  aliases: IHeaderAccountNameAliasesReq,
  aliasKey: keyof IHeaderAccountNameAliasesReq,
  headerPayload: { accountingEntity: IAccountingEntity; createdBy: TEntityId }
) {
  const defaultNames: Record<keyof IHeaderAccountNameAliasesReq, string> = {
    cash_and_cash_equivalent: 'Cash and Cash Equivalents',
    receivables: 'Receivables',
    short_term_debt: 'Short Term Debt',
    payable: 'Payables',
    retained_earnings: 'Retained Earnings',
    opening_balance: 'Opening Balance Equity',
    services: 'Services',
    employment_income: 'Employment Income',
    gain_on_asset_sale: 'Gain on Sale of Assets',
    unrealized_gains: 'Unrealized Gain',
    grants: 'Grants',
    gifts: 'Gifts',
    direct_costs: 'Direct Costs',
    rent_and_utilities: 'Rent and Utilities',
    bank_charge: 'Bank Charge',
    finance_cost: 'Finance Cost',
    interest: 'Interest',
    income_tax_expense: 'Tax Expense',
    unrealized_loss: 'Unrealized Loss',
    loss_on_asset_disposal: 'Asset Disposal Loss',
    trade_receivables: 'Trade Receivables',
    statutory_receivables: 'Statutory Receivables',
    trade_payables: 'Trade Payables',
    statutory_payables: 'Statutory Payables',
  };

  return {
    ...headerPayload,
    name: aliases[aliasKey] ?? defaultNames[aliasKey],
  };
}
