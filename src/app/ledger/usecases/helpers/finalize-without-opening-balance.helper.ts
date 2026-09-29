import IEventBus from '@shared/contracts/event-bus.contract';
import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import { IReadRepoOptions, IWriteRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import eventValue from '@shared/values/events/event.vo';
import { TAuditedEntity } from '@shared/values/events/types/event.types';
import historyValue from '@shared/values/history/history.vo';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';

import ILedgerAccountPersistenceService from '@app/ledger/contracts/ledger-account-persistence.service.contract';

import ledgerAccountToDtoMapperHelper from './ledger-account-to-dto-mapper.helper';

interface IDependencies {
  eventBus: IEventBus;
  repoService: IRepoService;
  ledgerAccountPersistenceService: ILedgerAccountPersistenceService;
}

interface IPayload {
  auditedAccount: TAuditedEntity<
    ILedgerAccount,
    ILedgerAccount,
    ILedgerAccount
  >;
  accountingEntity: IAccountingEntity;
  actor: TEntityId;
  repoOptions: IReadRepoOptions;
  persistRelatedRecords?: (
    account: ILedgerAccount,
    repoOptions: IWriteRepoOptions
  ) => Promise<void>;
}

/**
 * Persists a newly created ledger account without an opening-balance journal,
 * publishes its creation events after commit, and returns its zero-balance DTO.
 * Related account records, when supplied, are persisted in the same transaction.
 * @deprecated Migrate callers to finalizeWithoutOpeningBalanceWithAssignedCode
 * as code assignment expands beyond petty cash.
 * TODO: Remove after bank creation migrates, preserving its related-record writes
 * in the same transaction.
 */
export default async function finalizeWithoutOpeningBalance(
  deps: IDependencies,
  payload: IPayload
) {
  const [account, events, history] = payload.auditedAccount;

  const accountHistory = historyValue.make(
    history,
    payload.actor,
    payload.repoOptions.correlationId
  );

  const transactionFn: TRepoTransactionFn = async (tx) => {
    const writeRepoOptions = { ...payload.repoOptions, tx };

    await deps.ledgerAccountPersistenceService.create(
      account,
      payload.accountingEntity.functionalCurrencyCode,
      { ...writeRepoOptions, history: [accountHistory] }
    );

    await payload.persistRelatedRecords?.(account, writeRepoOptions);
  };

  await deps.repoService.runInTransaction(transactionFn);

  await deps.eventBus.publish(
    eventValue.enrichAll(events, payload.repoOptions)
  );

  return ledgerAccountToDtoMapperHelper(
    account,
    null,
    payload.accountingEntity.functionalCurrencyCode
  );
}
