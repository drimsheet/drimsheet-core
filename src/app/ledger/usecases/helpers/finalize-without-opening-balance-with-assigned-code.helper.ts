import IEventBus from '@shared/contracts/event-bus.contract';
import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { TAuditedLedgerAccount } from '@domain/ledger/types/ledger.types';

import ILedgerAccountPersistenceService from '@app/ledger/contracts/ledger-account-persistence.service.contract';

import ledgerAccountToDtoMapperHelper from './ledger-account-to-dto-mapper.helper';

interface IDependencies {
  eventBus: IEventBus;
  ledgerAccountPersistenceService: ILedgerAccountPersistenceService;
}

interface IPayload {
  auditedAccount: TAuditedLedgerAccount;
  accountingEntity: IAccountingEntity;
  allocationHeaderCode: string;
  actor: TEntityId;
  repoOptions: IReadRepoOptions;
}

/**
 * Assigns and persists a new account without an opening-balance journal, then
 * publishes its creation and assignment events and returns its zero-balance DTO.
 * TODO: Replace finalizeWithoutOpeningBalance after its remaining callers migrate.
 */
export default async function finalizeWithoutOpeningBalanceWithAssignedCode(
  deps: IDependencies,
  payload: IPayload
) {
  const [account, events, audit] = payload.auditedAccount;
  const accountHistory = historyValue.make(
    audit,
    payload.actor,
    payload.repoOptions.correlationId
  );

  const assignedAccount =
    await deps.ledgerAccountPersistenceService.createWithAssignedCode(
      {
        account,
        allocationHeaderCode: payload.allocationHeaderCode,
        actorId: payload.actor,
      },
      payload.accountingEntity.functionalCurrencyCode,
      { ...payload.repoOptions, history: [accountHistory] }
    );

  await deps.eventBus.publish(
    eventValue.enrichAll(
      [...events, ...assignedAccount.events],
      payload.repoOptions
    )
  );

  return ledgerAccountToDtoMapperHelper(
    assignedAccount.account,
    null,
    payload.accountingEntity.functionalCurrencyCode
  );
}
