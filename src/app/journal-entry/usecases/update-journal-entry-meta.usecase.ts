/**
 * SUMMARY
 * Updates a draft or posted journal's memo and existing line descriptions in
 * the selected accounting entity. Saves changes and audit history atomically
 * with optimistic version checks, then publishes events and returns the entry.
 * Unchanged updates produce no writes, history, or events.
 *
 * WHEN TO USE
 * Use for descriptive corrections that preserve the entry's financial effect.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */
import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';
import IJournalLineRepo from '@domain/journal-entry/repos/journal-line.repo';

import { IAppContextData } from '@app/context/types/app-context.types';
import { IJournalEntryDto } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import journalEntryDtoMapper from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.mapper';
import { IJournalEntryMetaUpdateReq } from '@app/journal-entry/dtos/meta-update/meta-update.dto';
import { journalEntryMetaUpdateReqValidation } from '@app/journal-entry/dtos/meta-update/meta-update.dto.validation';
import journalEntryMutationPolicy from '@app/journal-entry/policies/journal-entry-mutation.policy';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  journalEntryRepo: IJournalEntryRepo;
  journalLineRepo: IJournalLineRepo;
  repoService: IRepoService;
  eventBus: IEventBus;
}

export default function makeUpdateJournalEntryMetaUsecase(deps: IDependencies) {
  return async (
    id: string,
    payload: IJournalEntryMetaUpdateReq
  ): Promise<IJournalEntryDto> => {
    stringUtils.validateUUID(id, journalEntryError.InvalidJournalEntry);
    zodValidationRunner(journalEntryMetaUpdateReqValidation, payload);

    const { accountingEntity, actor, correlationId, idempotencyKey } =
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

    const descriptionsByLineId = new Map<
      TEntityId,
      string | null | undefined
    >();

    for (const lineUpdate of payload.lines ?? []) {
      const hasExistingLine = entry.lines.some(
        (line) => line.id === lineUpdate.id
      );
      const isInvalidLineReference =
        !hasExistingLine || descriptionsByLineId.has(lineUpdate.id);

      if (isInvalidLineReference) {
        throw new journalEntryError.RectificationLineId({ id: lineUpdate.id });
      }

      descriptionsByLineId.set(lineUpdate.id, lineUpdate.description);
    }

    const lines = entry.lines.map((line) => {
      const description = descriptionsByLineId.get(line.id);
      if (description === undefined) {
        return line;
      }

      return { ...line, description };
    });

    const [updatedEntry, events, audit] = journalEntryEntity.update(
      entry,
      { id: entry.id, memo: payload.header?.memo, lines },
      actor.id
    );

    if (!audit) {
      return journalEntryDtoMapper.toDto(updatedEntry);
    }

    const {
      lines: _lines,
      attachments: _attachments,
      ...header
    } = updatedEntry;

    const headerHistory = historyValue.make(
      audit.header,
      actor.id,
      correlationId
    );

    const lineUpdates = audit.lines.map((lineAudit) => ({
      line: updatedEntry.lines.find((line) => line.id === lineAudit.entityId)!,
      history: historyValue.make(lineAudit, actor.id, correlationId),
    }));

    const transaction = await deps.repoService.createTransaction();
    try {
      const writeOptions = { correlationId, tx: transaction.context };

      await deps.journalEntryRepo.update(header, {
        ...writeOptions,
        expectedVersion: entry.version,
        history: headerHistory,
      });

      for (const lineUpdate of lineUpdates) {
        await deps.journalLineRepo.update(lineUpdate.line, {
          ...writeOptions,
          accountingEntityId: accountingEntity.id,
          expectedVersion: lineUpdate.line.version - 1,
          history: lineUpdate.history,
        });
      }

      await transaction.commit();

      await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));

      return journalEntryDtoMapper.toDto(updatedEntry);
    } catch (error) {
      return await transaction.handleError(error);
    }
  };
}
