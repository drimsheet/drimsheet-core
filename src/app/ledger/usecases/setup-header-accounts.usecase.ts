import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
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
import ILedgerAccountPersistenceService from '@app/ledger/contracts/ledger-account-persistence.service.contract';
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

    const functionalCurrency = currencyEntity.getByCode(
      accountingEntity.functionalCurrencyCode
    );
    const transaction = await deps.repoService.createTransaction();

    try {
      const transactionOptions = { ...repoOptions, tx: transaction.context };
      const auditedCashHeader = await deps.cashAccountService.createHeader(
        getCreationInput(aliases, 'cash_and_cash_equivalent', headerPayload),
        transactionOptions
      );
      const auditedReceivablesHeader =
        await deps.receivablesAccountService.createHeader(
          getCreationInput(aliases, 'receivables', headerPayload),
          transactionOptions
        );
      const auditedShortTermDebtHeader =
        await deps.shortTermLoanAccountService.createHeader(
          getCreationInput(aliases, 'short_term_debt', headerPayload),
          transactionOptions
        );
      const auditedPayablesHeader =
        await deps.payablesAccountService.createHeader(
          getCreationInput(aliases, 'payable', headerPayload),
          transactionOptions
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
          transactionOptions
        ),
        await deps.equityAccountService.createOpeningBalanceAccount(
          getCreationInput(aliases, 'opening_balance', headerPayload),
          transactionOptions
        ),
        await deps.servicesAccountService.createHeader(
          getCreationInput(aliases, 'services', headerPayload),
          transactionOptions
        ),
        await deps.employmentIncomeAccountService.createHeader(
          getCreationInput(aliases, 'employment_income', headerPayload),
          transactionOptions
        ),
        await deps.gainOnAssetSaleAccountService.createHeader(
          getCreationInput(aliases, 'gain_on_asset_sale', headerPayload),
          transactionOptions
        ),
        await deps.unrealizedGainAccountService.createHeader(
          getCreationInput(aliases, 'unrealized_gains', headerPayload),
          transactionOptions
        ),
        await deps.grantsAccountService.createHeader(
          getCreationInput(aliases, 'grants', headerPayload),
          transactionOptions
        ),
        await deps.giftsAccountService.createHeader(
          getCreationInput(aliases, 'gifts', headerPayload),
          transactionOptions
        ),
        await deps.directCostsAccountService.createHeader(
          getCreationInput(aliases, 'direct_costs', headerPayload),
          transactionOptions
        ),
        await deps.rentAndUtilitiesAccountService.createHeader(
          getCreationInput(aliases, 'rent_and_utilities', headerPayload),
          transactionOptions
        ),
        await deps.bankChargeAccountService.createHeader(
          getCreationInput(aliases, 'bank_charge', headerPayload),
          transactionOptions
        ),
        await deps.financeCostAccountService.createHeader(
          getCreationInput(aliases, 'finance_cost', headerPayload),
          transactionOptions
        ),
        await deps.interestAccountService.createHeader(
          getCreationInput(aliases, 'interest', headerPayload),
          transactionOptions
        ),
        await deps.taxExpenseAccountService.createHeader(
          getCreationInput(aliases, 'income_tax_expense', headerPayload),
          transactionOptions
        ),
        await deps.unrealizedLossAccountService.createHeader(
          getCreationInput(aliases, 'unrealized_loss', headerPayload),
          transactionOptions
        ),
        await deps.assetDisposalLossAccountService.createHeader(
          getCreationInput(aliases, 'loss_on_asset_disposal', headerPayload),
          transactionOptions
        ),
      ];

      for (const auditedAccount of auditedAccounts) {
        const [account, , audit] = auditedAccount;
        const history = historyValue.make(audit, actor.id, correlationId);
        await deps.ledgerAccountPersistenceService.create(
          account,
          accountingEntity.functionalCurrencyCode,
          { ...transactionOptions, history: [history] }
        );
      }

      const tradeReceivableCreation =
        await deps.receivablesAccountService.createTradeReceivableSubAccount(
          {
            ...getCreationInput(aliases, 'trade_receivables', headerPayload),
            controlAccountId: receivablesHeader.id,
            isControlAccount: true,
            currency: functionalCurrency,
          },
          transactionOptions
        );
      const [tradeReceivable, , tradeReceivableAudit] = tradeReceivableCreation;
      const tradeReceivableHistory = historyValue.make(
        tradeReceivableAudit,
        actor.id,
        correlationId
      );
      await deps.ledgerAccountPersistenceService.create(
        tradeReceivable,
        accountingEntity.functionalCurrencyCode,
        { ...transactionOptions, history: [tradeReceivableHistory] }
      );
      auditedAccounts.push(tradeReceivableCreation);

      const statutoryReceivableCreation =
        await deps.receivablesAccountService.createStatutoryReceivableSubAccount(
          {
            ...getCreationInput(
              aliases,
              'statutory_receivables',
              headerPayload
            ),
            controlAccountId: receivablesHeader.id,
            isControlAccount: true,
            currency: functionalCurrency,
          },
          transactionOptions
        );
      const [statutoryReceivable, , statutoryReceivableAudit] =
        statutoryReceivableCreation;
      const statutoryReceivableHistory = historyValue.make(
        statutoryReceivableAudit,
        actor.id,
        correlationId
      );
      await deps.ledgerAccountPersistenceService.create(
        statutoryReceivable,
        accountingEntity.functionalCurrencyCode,
        { ...transactionOptions, history: [statutoryReceivableHistory] }
      );
      auditedAccounts.push(statutoryReceivableCreation);

      const tradePayableCreation =
        await deps.payablesAccountService.createTradePayableSubAccount(
          {
            ...getCreationInput(aliases, 'trade_payables', headerPayload),
            controlAccountId: payablesHeader.id,
            isControlAccount: true,
            meta: null,
          },
          transactionOptions
        );
      const [tradePayable, , tradePayableAudit] = tradePayableCreation;
      const tradePayableHistory = historyValue.make(
        tradePayableAudit,
        actor.id,
        correlationId
      );
      await deps.ledgerAccountPersistenceService.create(
        tradePayable,
        accountingEntity.functionalCurrencyCode,
        { ...transactionOptions, history: [tradePayableHistory] }
      );
      auditedAccounts.push(tradePayableCreation);

      const statutoryPayableCreation =
        await deps.payablesAccountService.createStatutoryPayableSubAccount(
          {
            ...getCreationInput(aliases, 'statutory_payables', headerPayload),
            controlAccountId: payablesHeader.id,
            isControlAccount: true,
            currency: functionalCurrency,
            meta: null,
          },
          transactionOptions
        );
      const [statutoryPayable, , statutoryPayableAudit] =
        statutoryPayableCreation;
      const statutoryPayableHistory = historyValue.make(
        statutoryPayableAudit,
        actor.id,
        correlationId
      );
      await deps.ledgerAccountPersistenceService.create(
        statutoryPayable,
        accountingEntity.functionalCurrencyCode,
        { ...transactionOptions, history: [statutoryPayableHistory] }
      );
      auditedAccounts.push(statutoryPayableCreation);

      await transaction.commit();

      const events = auditedAccounts.flatMap((creation) => creation[1]);
      await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));

      return auditedAccounts.map((creation) =>
        ledgerAccountToDtoMapperHelper(
          creation[0],
          null,
          accountingEntity.functionalCurrencyCode
        )
      );
    } catch (error) {
      return await transaction.handleError(error);
    } finally {
      await transaction.dispose();
    }
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
