import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import { IEmploymentIncomeAccountService } from '@domain/ledger/types/employment-income.service.types';
import { IGainOnAssetSaleAccountService } from '@domain/ledger/types/gain-on-sale.service.types';
import { IGiftsAccountService } from '@domain/ledger/types/gifts.service.types';
import { IGrantsAccountService } from '@domain/ledger/types/grants.service.types';
import { ERevenueAccountBehavior } from '@domain/ledger/types/revenue-account.types';
import { IServicesAccountService } from '@domain/ledger/types/services.service.types';
import { IUnrealizedGainAccountService } from '@domain/ledger/types/unrealized-gain.service.types';

import IAppContext from '@app/context/contracts/app-context.contract';
import ILedgerAccountPersistenceAppService from '@app/ledger/contracts/ledger-account-persistence.service.contract';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import { ICreateRevenueAccountDto } from '@app/ledger/dtos/revenue-account/revenue-account.dto';
import { createRevenueAccountValidation } from '@app/ledger/dtos/revenue-account/revenue-account.dto.validation';
import ledgerAccountToDtoMapperHelper from '@app/ledger/usecases/helpers/ledger-account-to-dto-mapper.helper';

interface IDependencies {
  appContext: IAppContext;
  eventBus: IEventBus;
  repoService: IRepoService;
  ledgerAccountPersistenceAppService: ILedgerAccountPersistenceAppService;
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
    const { create } = selectCreation(deps, payload.behavior);
    const repoOptions = { correlationId };
    const transaction = await deps.repoService.createTransaction();

    try {
      const transactionOptions = { ...repoOptions, tx: transaction.context };
      const auditedAccount = await create(
        {
          name: payload.name,
          status: payload.status,
          isControlAccount: payload.isControlAccount,
          controlAccountId: payload.controlAccountId as TEntityId | undefined,
          createdBy: actor.id,
          accountingEntityId: accountingEntity.id,
        },
        transactionOptions
      );

      const [account, events, audit] = auditedAccount;
      const accountHistory = historyValue.make(audit, actor.id, correlationId);

      await deps.ledgerAccountPersistenceAppService.create(
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
  behavior: ICreateRevenueAccountDto['behavior']
) {
  switch (behavior) {
    case ERevenueAccountBehavior.Services:
      return {
        create: deps.servicesAccountService.createSubAccount,
      };
    case ERevenueAccountBehavior.EmploymentIncome:
      return {
        create: deps.employmentIncomeAccountService.createSubAccount,
      };
    case ERevenueAccountBehavior.GainOnAssetSale:
      return {
        create: deps.gainOnAssetSaleAccountService.createSubAccount,
      };
    case ERevenueAccountBehavior.UnrealizedGains:
      return {
        create: deps.unrealizedGainAccountService.createSubAccount,
      };
    case ERevenueAccountBehavior.Grants:
      return {
        create: deps.grantsAccountService.createSubAccount,
      };
    case ERevenueAccountBehavior.Gifts:
      return {
        create: deps.giftsAccountService.createSubAccount,
      };
  }
}
