import IEventBus from '@shared/contracts/event-bus.contract';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import eventValue from '@shared/values/events/event.vo';
import historyValue from '@shared/values/history/history.vo';

import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';

import IAppContext from '@app/context/contracts/app-context.contract';
import { IJournalEntryDto } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import journalEntryDtoMapper from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.mapper';
import journalEntryMutationPolicy from '@app/journal-entry/policies/journal-entry-mutation.policy';

interface IDependencies {
  appContext: IAppContext;
  eventBus: IEventBus;
  journalEntryRepo: IJournalEntryRepo;
}

export default function makeArchiveJournalEntryUsecase(deps: IDependencies) {
  return async (id: string): Promise<IJournalEntryDto> => {
    stringUtils.validateUUID(id, journalEntryError.InvalidJournalEntry);

    const { correlationId, idempotencyKey, accountingEntity, actor } =
      deps.appContext.get(['actor', 'accountingEntity']);

    const repoOptions = { correlationId, idempotencyKey };

    const entry = await deps.journalEntryRepo.findById(
      id as TEntityId,
      repoOptions
    );

    const authorizedEntry = journalEntryMutationPolicy.validate({
      id,
      entry,
      accountingEntityId: accountingEntity.id,
    });

    const [archivedEntry, events, audit] =
      journalEntryEntity.archive(authorizedEntry);
    const history = historyValue.make(audit, actor.id, correlationId);

    const {
      lines: _lines,
      attachments: _attachments,
      ...header
    } = archivedEntry;

    await deps.journalEntryRepo.update(header, {
      correlationId,
      expectedVersion: authorizedEntry.version,
      history,
    });

    await deps.eventBus.publish(eventValue.enrichAll(events, repoOptions));

    return journalEntryDtoMapper.toDto(archivedEntry);
  };
}
