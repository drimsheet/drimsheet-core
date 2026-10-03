import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import { IPayablesAccountService } from '@domain/ledger/types/payables.service.types';
import currencyEntity from '@domain/money/entities/currency.entity';

import IAppContext from '@app/context/contracts/app-context.contract';
import ILedgerAccountPersistenceService from '@app/ledger/contracts/ledger-account-persistence.service.contract';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import { ICreateStatutoryPayableAccountDto } from '@app/ledger/dtos/payable-account/payable-account.dto';
import { createStatutoryPayableAccountValidation } from '@app/ledger/dtos/payable-account/payable-account.dto.validation';
import ledgerAccountToDtoMapperHelper from '@app/ledger/usecases/helpers/ledger-account-to-dto-mapper.helper';

interface IDependencies {
  appContext: IAppContext;
  eventBus: IEventBus;
  repoService: IRepoService;
  ledgerAccountPersistenceService: ILedgerAccountPersistenceService;
  payablesAccountService: IPayablesAccountService;
}

export default function makeCreateStatutoryPayableAccountUsecase(
  deps: Readonly<IDependencies>
) {
  return async (
    payload: ICreateStatutoryPayableAccountDto
  ): Promise<ILedgerAccountDto> => {
    zodValidationRunner(createStatutoryPayableAccountValidation, payload);
    const { actor, accountingEntity, correlationId } = deps.appContext.get([
      'actor',
      'accountingEntity',
    ]);
    const currency = currencyEntity.getByCode(payload.currencyCode);
    const repoOptions = { correlationId };
    const transaction = await deps.repoService.createTransaction();

    try {
      const transactionOptions = { ...repoOptions, tx: transaction.context };
      const auditedAccount =
        await deps.payablesAccountService.createStatutoryPayableSubAccount(
          {
            name: payload.name,
            status: payload.status,
            isControlAccount: payload.isControlAccount,
            controlAccountId: payload.controlAccountId as TEntityId | undefined,
            createdBy: actor.id,
            accountingEntity,
            currency,
            meta: payload.meta ?? null,
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
      await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));

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
