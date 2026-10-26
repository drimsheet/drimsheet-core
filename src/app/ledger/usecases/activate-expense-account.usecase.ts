/**
 * SUMMARY
 * Activates an eligible expense account in the selected entity. Saves the
 * account and audit together, then publishes activation events. An unchanged
 * activation performs no writes, audit, or events. Rejects missing or
 * ineligible accounts and returns no value.
 *
 * WHEN TO USE
 * Use when a saved expense account is ready for active use.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import IExpenseAccountService from '@domain/ledger/types/expense-account.service.types';

import { IAppContextData } from '@app/context/types/app-context.types';
import ledgerAppError from '@app/ledger/errors/ledger.error';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  eventBus: IEventBus;
  ledgerAccountRepo: ILedgerAccountRepo;
  expenseAccountService: IExpenseAccountService;
}

export default function makeActivateExpenseAccountUsecase(deps: IDependencies) {
  return async (id: string): Promise<void> => {
    stringUtils.validateUUID(id, ledgerAccountError.InvalidId);

    const { actor, accountingEntity, correlationId, idempotencyKey } =
      deps.appContext.get(['actor', 'accountingEntity']);

    const repoOptions = { correlationId };

    const existingAccount = await deps.ledgerAccountRepo.findById(
      id as TEntityId,
      accountingEntity.id,
      repoOptions
    );
    if (!existingAccount) {
      throw new ledgerAppError.AccountNotFound({ id });
    }

    const [account, events, audit] = await deps.expenseAccountService.activate(
      existingAccount,
      repoOptions
    );

    if (!audit) {
      return;
    }

    // The repository atomically saves the account and history; stale writes conflict.
    await deps.ledgerAccountRepo.update(account, {
      ...repoOptions,
      expectedVersion: existingAccount.version,
      history: historyValue.make(audit, actor.id, correlationId),
    });
    await deps.eventBus.publish(
      eventValue.enrichAll(events, { correlationId, idempotencyKey })
    );
  };
}
