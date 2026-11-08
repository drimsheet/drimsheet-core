/**
 * SUMMARY
 * Creates an opening-balance journal for an existing account in the selected
 * accounting entity and updates its opening-balance date. Requires an eligible
 * account and opening-balance equity account. The account's draft status
 * produces a draft journal; otherwise the opening date is used for posting.
 * Saves the journal, changed account date, audits, applicable foreign-exchange
 * acquisition, and pending balance work together. Requests any required balance
 * processing and publishes events. Returns no value.
 *
 * WHEN TO USE
 * Use to establish an existing account's opening balance from an amount, date,
 * and applicable exchange rate. Use post-draft-opening-balance to post an
 * already saved draft opening journal.
 *
 * SEQUENCE DIAGRAM
 * @see ./__docs__/create-opening-balance.sequence.md
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { ERepoLock } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import { IEvent } from '@shared/values/events/types/event.types';
import historyValue from '@shared/values/history/history.vo';

import { EJournalEntryStatus } from '@domain/journal-entry/types/journal-entry.types';
import { IOpeningBalanceEntryService } from '@domain/journal-entry/types/opening-balance-entry.service.types';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import { ELedgerAccountStatus } from '@domain/ledger/types/ledger.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';
import IFxCostBasisLotService from '@domain/subledger/fx-cost-basis/types/lot.service.types';

import { IAppContextData } from '@app/context/types/app-context.types';
import IJournalEntryPersistenceAppService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';
import { IOpeningBalanceCreationReq } from '@app/journal-entry/dtos/opening-balance/opening-balance.dto';
import { openingBalanceCreationReqValidation } from '@app/journal-entry/dtos/opening-balance/opening-balance.dto.validation';
import ILedgerBalanceAdjustmentQueue from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import IExchangeRateAppService from '@app/money/contracts/exchange-rate.service.contract';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';
import IOutboxAppService from '@app/outbox/contracts/outbox.service.contract';
import IFxCostBasisPersistenceAppService from '@app/subledger/fx-cost-basis/contracts/fx-cost-basis-persistence.service.contract';
import getFxLotEventsHelper from '@app/subledger/fx-cost-basis/get-fx-lot-events.helper';
import resolveOfficialRateHelper from '@app/subledger/fx-cost-basis/resolve-official-rate.helper';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  ledgerAccountRepo: ILedgerAccountRepo;
  eventBus: IEventBus;
  openingBalanceEntryService: IOpeningBalanceEntryService;
  journalEntryPersistenceAppService: IJournalEntryPersistenceAppService;
  outboxAppService: IOutboxAppService;
  ledgerBalanceAdjustmentQueue: ILedgerBalanceAdjustmentQueue;
  repoService: IRepoService;
  fxCostBasisPersistenceAppService: IFxCostBasisPersistenceAppService;
  fxCostBasisLotService: IFxCostBasisLotService;
  exchangeRateAppService: IExchangeRateAppService;
}

export default function makeCreateOpeningBalanceUseCase(deps: IDependencies) {
  return async (payload: IOpeningBalanceCreationReq) => {
    zodValidationRunner(openingBalanceCreationReqValidation, payload);

    const { accountingEntity, correlationId, actor } = deps.appContext.get([
      'actor',
      'accountingEntity',
    ]);
    const repoOptions = { correlationId };

    const transaction = await deps.repoService.createTransaction();
    try {
      const writeRepoOptions = { ...repoOptions, tx: transaction.context };

      // Serialize opening-journal creation and account-date assignment.
      const account = await deps.ledgerAccountRepo.findById(
        payload.accountId as TEntityId,
        accountingEntity.id,
        { ...writeRepoOptions, lock: ERepoLock.Update }
      );

      if (!account) {
        throw new ledgerAppError.AccountNotFound();
      }

      const createOpeningBalance =
        account.status === ELedgerAccountStatus.Draft
          ? deps.openingBalanceEntryService.createDraft
          : deps.openingBalanceEntryService.create;
      const openingBalanceCreation = await createOpeningBalance(
        {
          accountingEntityId: accountingEntity.id,
          functionalCurrencyCode: accountingEntity.functionalCurrencyCode,
          account,
          amount: moneyMapper.fromDto(payload.amount),
          effectiveDate: payload.date,
          exchangeRate: payload.exchangeRate
            ? exchangeRateValue.make(payload.exchangeRate)
            : null,
          createdBy: actor.id,
        },
        writeRepoOptions
      );
      const [journalEntry, journalEvents, audit] = openingBalanceCreation;

      const isPosted = journalEntry.status === EJournalEntryStatus.Posted;
      const fxAcquisition = isPosted
        ? deps.fxCostBasisLotService.acquire({
            journalEntry,
            account,
            createdBy: actor.id,
            officialRate: await resolveOfficialRateHelper(
              deps.exchangeRateAppService,
              journalEntry.lines,
              account.id,
              writeRepoOptions
            ),
          })
        : null;

      const accountUpdate = ledgerAccountEntity.updateOpeningBalanceDate(
        account,
        payload.date
      );
      const [updatedAccount, accountEvents, accountAudit] = accountUpdate;

      const accountHistory = accountAudit
        ? historyValue.make(accountAudit, actor.id, correlationId)
        : null;
      const headerHistory = historyValue.make(
        audit.header,
        actor.id,
        correlationId
      );
      const lineHistories = audit.lines.map((lineAudit) =>
        historyValue.make(lineAudit, actor.id, correlationId)
      );

      if (accountHistory) {
        await deps.ledgerAccountRepo.update(updatedAccount, {
          ...writeRepoOptions,
          expectedVersion: account.version,
          history: accountHistory,
        });
      }

      await deps.journalEntryPersistenceAppService.create(
        journalEntry,
        headerHistory,
        lineHistories,
        writeRepoOptions
      );

      if (fxAcquisition) {
        await deps.fxCostBasisPersistenceAppService.persistAcquisition(
          fxAcquisition,
          actor.id,
          writeRepoOptions
        );
      }

      if (isPosted) {
        await deps.outboxAppService.createBalancePropagation(
          journalEntry.id,
          writeRepoOptions
        );
      }

      await transaction.commit();

      const allEvents: IEvent<unknown>[] = [
        ...accountEvents,
        ...journalEvents,
        ...getFxLotEventsHelper(fxAcquisition),
      ];

      await deps.eventBus.publish(eventValue.enrichAll(allEvents, repoOptions));

      if (isPosted) {
        await deps.ledgerBalanceAdjustmentQueue.add(correlationId, {
          journalEntryId: journalEntry.id,
        });
      }
    } catch (error) {
      return await transaction.handleError(error);
    }
  };
}
