/**
 * SUMMARY
 * Archives a draft or posted journal in the selected accounting entity while
 * retaining its lines, attachments, and posting history. Saves the status
 * change with audit history, publishes the archival event, and returns the
 * journal. An already archived entry is returned without writes, audit, or
 * events. Archival does not reverse the entry or request balance changes;
 * missing or foreign entries and unsupported status transitions are rejected.
 *
 * WHEN TO USE
 * Use to retire an entry from ordinary active use while preserving its
 * financial effect. Use delete-journal-entry to discard an unposted entry or
 * cancel a posted entry.
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

import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';

import { IAppContextData } from '@app/context/types/app-context.types';
import { IJournalEntryDto } from '@app/journal-entry/dtos/journal-entry/journal-entry.dto';
import journalEntryDtoMapper from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.mapper';
import journalEntryMutationPolicy from '@app/journal-entry/policies/journal-entry-mutation.policy';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
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

    if (!audit) {
      return journalEntryDtoMapper.toDto(archivedEntry);
    }

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
