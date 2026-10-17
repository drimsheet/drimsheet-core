import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import { IEvent } from '@shared/values/events/types/event.types';
import historyValue from '@shared/values/history/history.vo';

import { IReceivablesAccountService } from '@domain/ledger/types/receivables-account.service.types';
import currencyEntity from '@domain/money/entities/currency.entity';

import { IAppContextData } from '@app/context/types/app-context.types';
import ILedgerAccountPersistenceAppService from '@app/ledger/contracts/ledger-account-persistence.service.contract';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import { ICreateStatutoryReceivableAccountDto } from '@app/ledger/dtos/receivable-account/receivable-account.dto';
import { createStatutoryReceivableAccountValidation } from '@app/ledger/dtos/receivable-account/receivable-account.dto.validation';
import ledgerAccountToDtoMapperHelper from '@app/ledger/usecases/helpers/ledger-account-to-dto-mapper.helper';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  eventBus: IEventBus;
  repoService: IRepoService;
  ledgerAccountPersistenceAppService: ILedgerAccountPersistenceAppService;
  receivablesAccountService: IReceivablesAccountService;
}

export default function makeCreateStatutoryReceivableAccountUsecase(
  deps: Readonly<IDependencies>
) {
  return async (
    payload: ICreateStatutoryReceivableAccountDto
  ): Promise<ILedgerAccountDto> => {
    zodValidationRunner(createStatutoryReceivableAccountValidation, payload);

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
        await deps.receivablesAccountService.createStatutoryReceivableSubAccount(
          {
            name: payload.name,
            status: payload.status,
            isControlAccount: payload.isControlAccount,
            controlAccountId: payload.controlAccountId as TEntityId | undefined,
            promotionNames: payload.promotionNames,
            createdBy: actor.id,
            accountingEntity,
            currency,
          },
          transactionOptions
        );

      const [account, creationEvents, audit, promotion] = auditedAccount;
      const events: IEvent<unknown>[] = [...creationEvents];
      if (promotion) {
        const [, controlEvents, controlAudit] = promotion.controlAccount;
        const [, postingEvents, postingAudit] = promotion.postingAccount;
        await deps.ledgerAccountPersistenceAppService.promote(promotion, {
          ...transactionOptions,
          history: [
            historyValue.make(controlAudit, actor.id, correlationId),
            ...(postingAudit
              ? [historyValue.make(postingAudit, actor.id, correlationId)]
              : []),
          ],
        });
        events.unshift(...controlEvents, ...postingEvents);
      }

      const accountHistory = historyValue.make(audit, actor.id, correlationId);

      await deps.ledgerAccountPersistenceAppService.create(
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
    }
  };
}
