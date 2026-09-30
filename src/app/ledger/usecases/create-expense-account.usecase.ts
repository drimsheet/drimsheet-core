import IEventBus from '@shared/contracts/event-bus.contract';
import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import { EXPENSE_LEDGER_CODES } from '@domain/ledger/config/expense-codes.config';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import { IAssetDisposalLossAccountService } from '@domain/ledger/types/asset-disposal-loss.service.types';
import { IBankChargeAccountService } from '@domain/ledger/types/bank-charge.service.types';
import { IDirectCostsAccountService } from '@domain/ledger/types/direct-costs.service.types';
import { EExpenseAccountBehavior } from '@domain/ledger/types/expense-account.types';
import { IFinanceCostAccountService } from '@domain/ledger/types/finance-cost.service.types';
import { IInterestAccountService } from '@domain/ledger/types/interest.service.types';
import { IRentAndUtilitiesAccountService } from '@domain/ledger/types/rent-and-utilities.service.types';
import { ITaxExpenseAccountService } from '@domain/ledger/types/tax-expense.service.types';
import { IUnrealizedLossAccountService } from '@domain/ledger/types/unrealized-loss.service.types';

import IAppContext from '@app/context/contracts/app-context.contract';
import ILedgerAccountPersistenceService, {
  IAssignedLedgerAccount,
} from '@app/ledger/contracts/ledger-account-persistence.service.contract';
import { ICreateExpenseAccountDto } from '@app/ledger/dtos/expense-account/expense-account.dto';
import { createExpenseAccountValidation } from '@app/ledger/dtos/expense-account/expense-account.dto.validation';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import getControlAccountHelper from '@app/ledger/usecases/helpers/get-control-account.helper';
import ledgerAccountToDtoMapperHelper from '@app/ledger/usecases/helpers/ledger-account-to-dto-mapper.helper';

interface IDependencies {
  appContext: IAppContext;
  eventBus: IEventBus;
  repoService: IRepoService;
  ledgerAccountRepo: ILedgerAccountRepo;
  ledgerAccountPersistenceService: ILedgerAccountPersistenceService;
  directCostsAccountService: IDirectCostsAccountService;
  rentAndUtilitiesAccountService: IRentAndUtilitiesAccountService;
  bankChargeAccountService: IBankChargeAccountService;
  financeCostAccountService: IFinanceCostAccountService;
  interestAccountService: IInterestAccountService;
  taxExpenseAccountService: ITaxExpenseAccountService;
  unrealizedLossAccountService: IUnrealizedLossAccountService;
  assetDisposalLossAccountService: IAssetDisposalLossAccountService;
}
type TSubAccountPayload = Parameters<
  IBankChargeAccountService['createSubAccount']
>[0];

export default function makeCreateExpenseAccountUsecase(
  deps: Readonly<IDependencies>
) {
  return async (
    payload: ICreateExpenseAccountDto
  ): Promise<ILedgerAccountDto> => {
    zodValidationRunner(createExpenseAccountValidation, payload);
    const { actor, accountingEntity, correlationId } = deps.appContext.get([
      'actor',
      'accountingEntity',
    ]);
    const repoOptions = { correlationId };
    const { allocationHeaderCode, create } = selectCreation(
      deps,
      payload.behavior
    );
    const controlAccount = await getControlAccountHelper({
      ledgerAccountRepo: deps.ledgerAccountRepo,
      controlAccountId: payload.controlAccountId,
      defaultControlAccountCode: allocationHeaderCode,
      accountingEntityId: accountingEntity.id,
      repoOptions,
    });
    const auditedAccount = create({
      name: payload.name,
      isControlAccount: payload.isControlAccount,
      controlAccount,
      createdBy: actor.id,
      accountingEntityId: accountingEntity.id,
    });

    const [account, events, audit] = auditedAccount;
    const accountHistory = historyValue.make(audit, actor.id, correlationId);

    const transactionFn: TRepoTransactionFn<IAssignedLedgerAccount> = async (
      tx
    ) => {
      return deps.ledgerAccountPersistenceService.createAndAssignCode(
        { account, allocationHeaderCode, actorId: actor.id },
        accountingEntity.functionalCurrencyCode,
        { ...repoOptions, tx, history: [accountHistory] }
      );
    };
    const assignedAccount =
      await deps.repoService.runInTransaction(transactionFn);

    await deps.eventBus.publish(
      eventValue.enrichAll([...events, ...assignedAccount.events], repoOptions)
    );

    return ledgerAccountToDtoMapperHelper(
      assignedAccount.account,
      null,
      accountingEntity.functionalCurrencyCode
    );
  };
}

/** Selects the existing domain factory and allocation root for a supported behavior. */
function selectCreation(
  deps: IDependencies,
  behavior: ICreateExpenseAccountDto['behavior']
) {
  switch (behavior) {
    case EExpenseAccountBehavior.DefaultDirectCost:
    case EExpenseAccountBehavior.COGS:
    case EExpenseAccountBehavior.CostOfServices:
    case EExpenseAccountBehavior.CostOfRevenue:
      return {
        allocationHeaderCode: EXPENSE_LEDGER_CODES.DIRECT_COSTS.HEADER,
        create: (payload: TSubAccountPayload) =>
          deps.directCostsAccountService.createSubAccount({
            ...payload,
            behavior,
          }),
      };
    case EExpenseAccountBehavior.RentAndUtilities:
      return {
        allocationHeaderCode: EXPENSE_LEDGER_CODES.RENT_AND_UTILITIES.HEADER,
        create: deps.rentAndUtilitiesAccountService.createSubAccount,
      };
    case EExpenseAccountBehavior.BankCharge:
      return {
        allocationHeaderCode: EXPENSE_LEDGER_CODES.BANK_CHARGE.HEADER,
        create: deps.bankChargeAccountService.createSubAccount,
      };
    case EExpenseAccountBehavior.FinanceCost:
      return {
        allocationHeaderCode: EXPENSE_LEDGER_CODES.FINANCE_COST.HEADER,
        create: deps.financeCostAccountService.createSubAccount,
      };
    case EExpenseAccountBehavior.Interest:
      return {
        allocationHeaderCode: EXPENSE_LEDGER_CODES.INTEREST.HEADER,
        create: deps.interestAccountService.createSubAccount,
      };
    case EExpenseAccountBehavior.TaxExpense:
      return {
        allocationHeaderCode: EXPENSE_LEDGER_CODES.TAX_EXPENSE.HEADER,
        create: deps.taxExpenseAccountService.createSubAccount,
      };
    case EExpenseAccountBehavior.UnrealizedLoss:
      return {
        allocationHeaderCode: EXPENSE_LEDGER_CODES.UNREALIZED_LOSS.HEADER,
        create: deps.unrealizedLossAccountService.createSubAccount,
      };
    case EExpenseAccountBehavior.AssetDisposalLoss:
      return {
        allocationHeaderCode: EXPENSE_LEDGER_CODES.ASSET_DISPOSAL_LOSS.HEADER,
        create: deps.assetDisposalLossAccountService.createSubAccount,
      };
  }
}
