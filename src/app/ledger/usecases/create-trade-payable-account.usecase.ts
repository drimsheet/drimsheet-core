import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import { IPayablesAccountService } from '@domain/ledger/types/payables.service.types';

import IAppContext from '@app/context/contracts/app-context.contract';
import ILedgerAccountPersistenceService from '@app/ledger/contracts/ledger-account-persistence.service.contract';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import { ICreateTradePayableAccountDto } from '@app/ledger/dtos/payable-account/payable-account.dto';
import { createTradePayableAccountValidation } from '@app/ledger/dtos/payable-account/payable-account.dto.validation';
import ledgerAccountToDtoMapperHelper from '@app/ledger/usecases/helpers/ledger-account-to-dto-mapper.helper';

interface IDependencies {
  appContext: IAppContext;
  eventBus: IEventBus;
  repoService: IRepoService;
  ledgerAccountPersistenceService: ILedgerAccountPersistenceService;
  payablesAccountService: IPayablesAccountService;
}

export default function makeCreateTradePayableAccountUsecase(
  deps: Readonly<IDependencies>
) {
  return async (
    payload: ICreateTradePayableAccountDto
  ): Promise<ILedgerAccountDto> => {
    zodValidationRunner(createTradePayableAccountValidation, payload);

    const { actor, accountingEntity, correlationId } = deps.appContext.get([
      'actor',
      'accountingEntity',
    ]);

    const repoOptions = { correlationId };
    const transaction = await deps.repoService.createTransaction();

    try {
      const transactionOptions = { ...repoOptions, tx: transaction.context };
      const auditedAccount =
        await deps.payablesAccountService.createTradePayableSubAccount(
          {
            name: payload.name,
            isControlAccount: payload.isControlAccount,
            controlAccountId: payload.controlAccountId as TEntityId | undefined,
            createdBy: actor.id,
            accountingEntity,
            meta: payload.meta
              ? {
                  counterpartyId: payload.meta.counterpartyId as TEntityId,
                  invoiceId: payload.meta.invoiceId as TEntityId,
                }
              : null,
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
