import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

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
import ILedgerAccountPersistenceService from '@app/ledger/contracts/ledger-account-persistence.service.contract';
import { ICreateExpenseAccountDto } from '@app/ledger/dtos/expense-account/expense-account.dto';
import { createExpenseAccountValidation } from '@app/ledger/dtos/expense-account/expense-account.dto.validation';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import ledgerAccountToDtoMapperHelper from '@app/ledger/usecases/helpers/ledger-account-to-dto-mapper.helper';

interface IDependencies {
  appContext: IAppContext;
  eventBus: IEventBus;
  repoService: IRepoService;
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
    const { create } = selectCreation(deps, payload.behavior);
    const repoOptions = { correlationId };
    const transaction = await deps.repoService.createTransaction();

    try {
      const transactionOptions = { ...repoOptions, tx: transaction.context };
      const auditedAccount = await create(
        {
          name: payload.name,
          isControlAccount: payload.isControlAccount,
          controlAccountId: payload.controlAccountId as TEntityId | undefined,
          createdBy: actor.id,
          accountingEntityId: accountingEntity.id,
        },
        transactionOptions
      );

      const [account, events, audit] = auditedAccount;
      const accountHistory = historyValue.make(audit, actor.id, correlationId);

      await deps.ledgerAccountPersistenceService.create(
        account,
        accountingEntity.functionalCurrencyCode,
        { ...transactionOptions, history: [accountHistory] }
      );

      await transaction.commit();
      await deps.eventBus.publish(
        eventValue.enrichAll<unknown>(events, repoOptions)
      );

      return ledgerAccountToDtoMapperHelper(
        account,
        null,
        accountingEntity.functionalCurrencyCode
      );
    } catch (error) {
      return await transaction.handleError(error);
    } finally {
      await transaction.dispose();
    }
  };
}

/** Selects the existing domain factory for a supported behavior. */
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
        create: (
          payload: TSubAccountPayload,
          repoOptions: Parameters<
            IBankChargeAccountService['createSubAccount']
          >[1]
        ) =>
          deps.directCostsAccountService.createSubAccount(
            {
              ...payload,
              behavior,
            },
            repoOptions
          ),
      };
    case EExpenseAccountBehavior.RentAndUtilities:
      return {
        create: deps.rentAndUtilitiesAccountService.createSubAccount,
      };
    case EExpenseAccountBehavior.BankCharge:
      return {
        create: deps.bankChargeAccountService.createSubAccount,
      };
    case EExpenseAccountBehavior.FinanceCost:
      return {
        create: deps.financeCostAccountService.createSubAccount,
      };
    case EExpenseAccountBehavior.Interest:
      return {
        create: deps.interestAccountService.createSubAccount,
      };
    case EExpenseAccountBehavior.TaxExpense:
      return {
        create: deps.taxExpenseAccountService.createSubAccount,
      };
    case EExpenseAccountBehavior.UnrealizedLoss:
      return {
        create: deps.unrealizedLossAccountService.createSubAccount,
      };
    case EExpenseAccountBehavior.AssetDisposalLoss:
      return {
        create: deps.assetDisposalLossAccountService.createSubAccount,
      };
  }
}
