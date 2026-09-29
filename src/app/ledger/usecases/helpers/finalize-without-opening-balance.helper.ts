import IEventBus from '@shared/contracts/event-bus.contract';
import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import { IReadRepoOptions, IWriteRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import {
  ILedgerAccount,
  TAuditedLedgerAccount,
} from '@domain/ledger/types/ledger.types';

import ILedgerAccountPersistenceService, {
  IAssignedLedgerAccount,
} from '@app/ledger/contracts/ledger-account-persistence.service.contract';

import ledgerAccountToDtoMapperHelper from './ledger-account-to-dto-mapper.helper';

interface IDependencies {
  eventBus: IEventBus;
  repoService: IRepoService;
  ledgerAccountPersistenceService: ILedgerAccountPersistenceService;
}

interface IPayload {
  auditedAccount: TAuditedLedgerAccount;
  allocationHeaderCode: string;
  accountingEntity: IAccountingEntity;
  actor: TEntityId;
  repoOptions: IReadRepoOptions;
  persistRelatedRecords?: (
    account: ILedgerAccount,
    repoOptions: IWriteRepoOptions
  ) => Promise<void>;
}

/**
 * Assigns and persists a new account and related records in one transaction.
 * Publishes creation and assignment events only after that outer commit.
 */
export default async function finalizeWithoutOpeningBalanceHelper(
  deps: IDependencies,
  payload: IPayload
) {
  const [account, events, history] = payload.auditedAccount;

  const accountHistory = historyValue.make(
    history,
    payload.actor,
    payload.repoOptions.correlationId
  );

  const transactionFn: TRepoTransactionFn<IAssignedLedgerAccount> = async (
    tx
  ) => {
    const writeRepoOptions = { ...payload.repoOptions, tx };

    const assignedAccount =
      await deps.ledgerAccountPersistenceService.createAndAssignCode(
        {
          account,
          allocationHeaderCode: payload.allocationHeaderCode,
          actorId: payload.actor,
        },
        payload.accountingEntity.functionalCurrencyCode,
        { ...writeRepoOptions, history: [accountHistory] }
      );

    await payload.persistRelatedRecords?.(
      assignedAccount.account,
      writeRepoOptions
    );

    return assignedAccount;
  };

  const assignedAccount =
    await deps.repoService.runInTransaction(transactionFn);

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
