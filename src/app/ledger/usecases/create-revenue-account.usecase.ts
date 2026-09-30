import IEventBus from '@shared/contracts/event-bus.contract';
import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import { REVENUE_LEDGER_CODES } from '@domain/ledger/config/revenue-codes.config';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import { IEmploymentIncomeAccountService } from '@domain/ledger/types/employment-income.service.types';
import { IGainOnAssetSaleAccountService } from '@domain/ledger/types/gain-on-sale.service.types';
import { IGiftsAccountService } from '@domain/ledger/types/gifts.service.types';
import { IGrantsAccountService } from '@domain/ledger/types/grants.service.types';
import { ERevenueAccountBehavior } from '@domain/ledger/types/revenue-account.types';
import { IServicesAccountService } from '@domain/ledger/types/services.service.types';
import { IUnrealizedGainAccountService } from '@domain/ledger/types/unrealized-gain.service.types';

import IAppContext from '@app/context/contracts/app-context.contract';
import ILedgerAccountPersistenceService, {
  IAssignedLedgerAccount,
} from '@app/ledger/contracts/ledger-account-persistence.service.contract';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import { ICreateRevenueAccountDto } from '@app/ledger/dtos/revenue-account/revenue-account.dto';
import { createRevenueAccountValidation } from '@app/ledger/dtos/revenue-account/revenue-account.dto.validation';
import getControlAccountHelper from '@app/ledger/usecases/helpers/get-control-account.helper';
import ledgerAccountToDtoMapperHelper from '@app/ledger/usecases/helpers/ledger-account-to-dto-mapper.helper';

interface IDependencies {
  appContext: IAppContext;
  eventBus: IEventBus;
  repoService: IRepoService;
  ledgerAccountRepo: ILedgerAccountRepo;
  ledgerAccountPersistenceService: ILedgerAccountPersistenceService;
  servicesAccountService: IServicesAccountService;
  employmentIncomeAccountService: IEmploymentIncomeAccountService;
  gainOnAssetSaleAccountService: IGainOnAssetSaleAccountService;
  unrealizedGainAccountService: IUnrealizedGainAccountService;
  grantsAccountService: IGrantsAccountService;
  giftsAccountService: IGiftsAccountService;
}

export default function makeCreateRevenueAccountUsecase(
  deps: Readonly<IDependencies>
) {
  return async (
    payload: ICreateRevenueAccountDto
  ): Promise<ILedgerAccountDto> => {
    zodValidationRunner(createRevenueAccountValidation, payload);
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
  behavior: ICreateRevenueAccountDto['behavior']
) {
  switch (behavior) {
    case ERevenueAccountBehavior.Services:
      return {
        allocationHeaderCode: REVENUE_LEDGER_CODES.SERVICES.HEADER,
        create: deps.servicesAccountService.createSubAccount,
      };
    case ERevenueAccountBehavior.EmploymentIncome:
      return {
        allocationHeaderCode: REVENUE_LEDGER_CODES.EMPLOYMENT_INCOME.HEADER,
        create: deps.employmentIncomeAccountService.createSubAccount,
      };
    case ERevenueAccountBehavior.GainOnAssetSale:
      return {
        allocationHeaderCode: REVENUE_LEDGER_CODES.GAIN_ON_ASSET_SALE.HEADER,
        create: deps.gainOnAssetSaleAccountService.createSubAccount,
      };
    case ERevenueAccountBehavior.UnrealizedGains:
      return {
        allocationHeaderCode: REVENUE_LEDGER_CODES.UNREALIZED_GAINS.HEADER,
        create: deps.unrealizedGainAccountService.createSubAccount,
      };
    case ERevenueAccountBehavior.Grants:
      return {
        allocationHeaderCode: REVENUE_LEDGER_CODES.GRANTS.HEADER,
        create: deps.grantsAccountService.createSubAccount,
      };
    case ERevenueAccountBehavior.Gifts:
      return {
        allocationHeaderCode: REVENUE_LEDGER_CODES.GIFTS.HEADER,
        create: deps.giftsAccountService.createSubAccount,
      };
  }
}
