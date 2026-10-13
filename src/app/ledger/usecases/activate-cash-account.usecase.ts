import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import { IJournalEntryService } from '@domain/journal-entry/types/journal-entry.service.types';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ICashAccountService from '@domain/ledger/types/cash-account.service.types';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';

import IAppContext from '@app/context/contracts/app-context.contract';
import IJournalEntryPersistenceAppService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';
import IJournalEntryQueryRepo from '@app/journal-entry/contracts/journal-entry.query.repo.contract';
import getJournalEntryPersistencePayloadHelper from '@app/journal-entry/usecases/helpers/get-journal-entry-persistence-payload.helper';
import ILedgerBalanceAdjustmentQueue from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
import IOutboxAppService from '@app/outbox/contracts/outbox.service.contract';
import IFxCostBasisPersistenceAppService from '@app/subledger/fx-cost-basis/contracts/fx-cost-basis-persistence.service.contract';
import IFxLotAppService from '@app/subledger/fx-cost-basis/contracts/fx-lot.service.contract';

interface IDependencies {
  appContext: IAppContext;
  ledgerAccountRepo: ILedgerAccountRepo;
  cashAccountService: ICashAccountService;
  repoService: IRepoService;
  eventBus: IEventBus;
  journalEntryQueryRepo: IJournalEntryQueryRepo;
  journalEntryService: IJournalEntryService;
  journalEntryPersistenceAppService: IJournalEntryPersistenceAppService;
  fxLotAppService: IFxLotAppService;
  fxCostBasisPersistenceAppService: IFxCostBasisPersistenceAppService;
  outboxAppService: IOutboxAppService;
  ledgerBalanceAdjustmentQueue: ILedgerBalanceAdjustmentQueue;
}

export default function makeActivateCashAccountUsecase(deps: IDependencies) {
  return async (id: string): Promise<void> => {
    stringUtils.validateUUID(id, ledgerAccountError.InvalidId);

    const { actor, accountingEntity, correlationId, idempotencyKey } =
      deps.appContext.get(['actor', 'accountingEntity']);

    const repoOptions = { correlationId };

    const account = await deps.ledgerAccountRepo.findById(
      id as TEntityId,
      accountingEntity.id,
      repoOptions
    );

    if (!account) {
      throw new ledgerAccountError.AccountNotFound({ id });
    }
    const activation = await deps.cashAccountService.activate(
      account,
      repoOptions
    );
    const [activatedAccount, accountEvents, audit] = activation;
    const history = historyValue.make(audit, actor.id, correlationId);
    const openingBalancePosting = await prepareOpeningBalancePosting(
      deps,
      activatedAccount,
      actor.id,
      repoOptions
    );

    const transaction = await deps.repoService.createTransaction();
    try {
      const transactionOptions = { ...repoOptions, tx: transaction.context };
      await deps.ledgerAccountRepo.update(activatedAccount, {
        ...transactionOptions,
        expectedVersion: account.version,
        history,
      });

      if (openingBalancePosting) {
        await deps.journalEntryPersistenceAppService.rectify(
          openingBalancePosting.persistence,
          transactionOptions
        );

        if (openingBalancePosting.fxAcquisition) {
          await deps.fxCostBasisPersistenceAppService.persistAcquisition(
            openingBalancePosting.fxAcquisition.records,
            transactionOptions
          );
        }

        await deps.outboxAppService.createBalancePropagation(
          openingBalancePosting.entry.id,
          transactionOptions
        );
      }

      await transaction.commit();

      const events = [
        ...accountEvents,
        ...(openingBalancePosting?.events ?? []),
        ...(openingBalancePosting?.fxAcquisition?.events ?? []),
      ];

      await deps.eventBus.publish(
        eventValue.enrichAll(events, {
          correlationId,
          idempotencyKey,
        })
      );

      if (openingBalancePosting) {
        await deps.ledgerBalanceAdjustmentQueue.add({
          journalEntryId: openingBalancePosting.entry.id,
          correlationId,
        });
      }
    } catch (error) {
      return await transaction.handleError(error);
    }
  };
}

/** Prepares the associated draft opening journal and its FX/history effects before the atomic write phase. Other draft journals are not selected. */
async function prepareOpeningBalancePosting(
  deps: IDependencies,
  account: ILedgerAccount,
  actor: TEntityId,
  repoOptions: IReadRepoOptions
) {
  const openingBalances = await deps.journalEntryQueryRepo.findAll(
    account.accountingEntityId,
    {
      ...repoOptions,
      accountId: account.id,
      sourceType: EJournalEntrySourceType.OpeningBalance,
      status: EJournalEntryStatus.Draft,
      limit: 1,
    }
  );
  const originalEntry = openingBalances.data[0];
  if (!originalEntry) return null;

  const posting = await deps.journalEntryService.postOpeningBalance(
    { entry: originalEntry, account, actor },
    repoOptions
  );
  const [entry, events, audit] = posting;
  const fxAcquisition = await deps.fxLotAppService.acquire(
    { journalEntry: entry, account, actor },
    repoOptions
  );
  const persistence = getJournalEntryPersistencePayloadHelper(
    {
      entriesToCreate: [],
      entryUpdate: {
        entry,
        expectedVersion: originalEntry.version,
        headerAudit: audit.header,
        lineAudits: audit.lines,
        linesToCreate: [],
        linesToUpdate: [],
        lineIdsToDelete: [],
      },
    },
    actor,
    repoOptions.correlationId
  );

  return { entry, events, persistence, fxAcquisition };
}
