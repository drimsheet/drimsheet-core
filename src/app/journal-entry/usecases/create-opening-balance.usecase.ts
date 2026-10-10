import IEventBus from '@shared/contracts/event-bus.contract';
import {
  IRepoService,
  TRepoTransactionFn,
} from '@shared/contracts/repo.contract';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import { IEvent } from '@shared/values/events/types/event.types';
import historyValue from '@shared/values/history/history.vo';

import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';

import IAppContext from '@app/context/contracts/app-context.contract';
import IJournalEntryPersistenceAppService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';
import IOpeningBalanceEntryAppService from '@app/journal-entry/contracts/opening-balance-entry.service.contract';
import { IOpeningBalanceCreationReq } from '@app/journal-entry/dtos/opening-balance/opening-balance.dto';
import { openingBalanceCreationReqValidation } from '@app/journal-entry/dtos/opening-balance/opening-balance.dto.validation';
import ILedgerBalanceAdjustmentQueue from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import IOutboxAppService from '@app/outbox/contracts/outbox.service.contract';
import IFxCostBasisPersistenceAppService from '@app/subledger/fx-cost-basis/contracts/fx-cost-basis-persistence.service.contract';

interface IDependencies {
  appContext: IAppContext;
  ledgerAccountRepo: ILedgerAccountRepo;
  eventBus: IEventBus;
  openingBalanceEntryAppService: IOpeningBalanceEntryAppService;
  journalEntryPersistenceAppService: IJournalEntryPersistenceAppService;
  outboxAppService: IOutboxAppService;
  ledgerBalanceAdjustmentQueue: ILedgerBalanceAdjustmentQueue;
  repoService: IRepoService;
  fxCostBasisPersistenceAppService: IFxCostBasisPersistenceAppService;
}

export default function makeCreateOpeningBalanceUseCase(deps: IDependencies) {
  return async (payload: IOpeningBalanceCreationReq) => {
    zodValidationRunner(openingBalanceCreationReqValidation, payload);

    const { accountingEntity, correlationId, actor } = deps.appContext.get([
      'actor',
      'accountingEntity',
    ]);
    const repoOptions = { correlationId };

    const account = await deps.ledgerAccountRepo.findById(
      payload.accountId as TEntityId,
      accountingEntity.id,
      repoOptions
    );

    if (!account) throw new ledgerAppError.AccountNotFound();

    const openingBalanceCreation =
      await deps.openingBalanceEntryAppService.create(
        {
          account,
          openingBalance: {
            amount: payload.amount,
            exchangeRate: payload.exchangeRate,
            date: payload.date,
          },
          accountingEntity,
          actor: actor.id,
        },
        repoOptions
      );
    const [journalEntry, journalEvents, audit] =
      openingBalanceCreation.creation;

    const accountUpdate = ledgerAccountEntity.updateOpeningBalanceDate(
      account,
      payload.date
    );
    const [updatedAccount, accountEvents, accountAudit] = accountUpdate;

    const accountHistory = historyValue.make(
      accountAudit,
      actor.id,
      correlationId
    );
    const headerHistory = historyValue.make(
      audit.header,
      actor.id,
      correlationId
    );
    const lineHistories = audit.lines.map((lineAudit) =>
      historyValue.make(lineAudit, actor.id, correlationId)
    );

    const fxAcquisition = openingBalanceCreation.fxAcquisition;

    const transactionFn: TRepoTransactionFn = async (tx) => {
      const writeRepoOptions = { ...repoOptions, tx };

      await deps.ledgerAccountRepo.update(updatedAccount, {
        ...writeRepoOptions,
        expectedVersion: account.version,
        history: accountHistory,
      });

      await deps.journalEntryPersistenceAppService.create(
        journalEntry,
        headerHistory,
        lineHistories,
        writeRepoOptions
      );

      if (fxAcquisition) {
        await deps.fxCostBasisPersistenceAppService.persistAcquisition(
          fxAcquisition.records,
          writeRepoOptions
        );
      }

      for (const entry of openingBalanceCreation.entriesForBalancePropagation) {
        await deps.outboxAppService.createBalancePropagation(
          entry.id,
          writeRepoOptions
        );
      }
    };

    await deps.repoService.runInTransaction(transactionFn);

    for (const entry of openingBalanceCreation.entriesForBalancePropagation) {
      await deps.ledgerBalanceAdjustmentQueue.add({
        journalEntryId: entry.id,
        correlationId,
      });
    }

    const allEvents: IEvent<unknown>[] = [
      ...accountEvents,
      ...journalEvents,
      ...(fxAcquisition?.events ?? []),
    ];
    deps.eventBus.publish(eventValue.enrichAll(allEvents, repoOptions));
  };
}
