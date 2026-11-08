/**
 * SUMMARY
 * Updates an existing draft receipt in the selected accounting entity. Saves
 * the journal, lines, and audit history atomically, then publishes events.
 * An unchanged draft returns without writes or events.
 *
 * WHEN TO USE
 * Use to edit a receipt's memo or lines before posting.
 *
 * SEQUENCE DIAGRAM
 * The workflow has one atomic persistence bundle.
 */
import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';
import { IReceiptEntryService } from '@domain/journal-entry/types/receipt-entry.service.types';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';

import { IAppContextData } from '@app/context/types/app-context.types';
import IJournalEntryPersistenceAppService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';
import { IDraftJournalEntryDto } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import journalEntryDtoMapper from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.mapper';
import { IUpdateDraftReceiptReq } from '@app/journal-entry/dtos/receipt-entry/receipt-entry.dto';
import { updateDraftReceiptReqValidation } from '@app/journal-entry/dtos/receipt-entry/receipt-entry.dto.validation';
import journalEntryMutationPolicy from '@app/journal-entry/policies/journal-entry-mutation.policy';
import getDraftJournalAccountsHelper from '@app/journal-entry/usecases/helpers/get-draft-journal-accounts.helper';
import getDraftJournalCounterpartiesHelper from '@app/journal-entry/usecases/helpers/get-draft-journal-counterparties.helper';
import getJournalLineChangesHelper from '@app/journal-entry/usecases/helpers/get-journal-line-changes.helper';
import mapDraftJournalLinePatchHelper from '@app/journal-entry/usecases/helpers/map-draft-journal-line-patch.helper';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  journalEntryRepo: IJournalEntryRepo;
  ledgerAccountRepo: ILedgerAccountRepo;
  counterpartyRepo: ICounterpartyRepo;
  receiptEntryService: IReceiptEntryService;
  journalEntryPersistenceAppService: IJournalEntryPersistenceAppService;
  eventBus: IEventBus;
}

export default function makeUpdateDraftReceiptUsecase(deps: IDependencies) {
  return async (
    id: string,
    payload: IUpdateDraftReceiptReq
  ): Promise<IDraftJournalEntryDto> => {
    stringUtils.validateUUID(id, journalEntryError.InvalidJournalEntry);
    zodValidationRunner(updateDraftReceiptReqValidation, payload);

    const { actor, accountingEntity, correlationId, idempotencyKey } =
      deps.appContext.get(['actor', 'accountingEntity']);

    const repoOptions = { correlationId, idempotencyKey };

    const storedEntry = await deps.journalEntryRepo.findById(
      id as TEntityId,
      repoOptions
    );

    const entry = journalEntryMutationPolicy.validate({
      id,
      entry: storedEntry,
      accountingEntityId: accountingEntity.id,
    });

    const sourceLines = payload.sourceLines?.map(
      mapDraftJournalLinePatchHelper
    );
    const destinationLine =
      payload.destinationLine &&
      mapDraftJournalLinePatchHelper(payload.destinationLine);

    const requestedLines = destinationLine
      ? [...(sourceLines ?? []), destinationLine]
      : (sourceLines ?? []);
    const hasLineEdits =
      sourceLines !== undefined || destinationLine !== undefined;

    const accounts = hasLineEdits
      ? await getDraftJournalAccountsHelper({
          accountingEntityId: entry.accountingEntityId,
          storedLines: entry.lines,
          requestedLines,
          repo: deps.ledgerAccountRepo,
          repoOptions,
        })
      : [];
    const counterparties = hasLineEdits
      ? await getDraftJournalCounterpartiesHelper({
          accountingEntityId: entry.accountingEntityId,
          storedLines: entry.lines,
          requestedLines,
          repo: deps.counterpartyRepo,
          repoOptions,
        })
      : [];

    const [updatedEntry, events, audit] = deps.receiptEntryService.updateDraft({
      entry,
      actor: actor.id,
      memo: payload.memo,
      sourceLines,
      destinationLine,
      accounts,
      counterparties,
    });
    const { effectiveDate: _effectiveDate, ...draft } =
      journalEntryDtoMapper.toDto(updatedEntry);

    if (!audit) {
      return draft;
    }

    const update = {
      entry: updatedEntry,
      expectedVersion: entry.version,
      headerHistory: historyValue.make(audit.header, actor.id, correlationId),
      lineHistories: audit.lines.map((lineAudit) =>
        historyValue.make(lineAudit, actor.id, correlationId)
      ),
      ...getJournalLineChangesHelper(entry.lines, updatedEntry.lines),
    };

    await deps.journalEntryPersistenceAppService.update(update, repoOptions);
    await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));

    return draft;
  };
}
