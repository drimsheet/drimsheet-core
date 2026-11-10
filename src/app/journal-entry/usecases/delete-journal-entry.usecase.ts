/**
 * SUMMARY
 * Deletes a draft journal entry from the selected accounting entity and
 * publishes the deletion event after the write commits.
 *
 * WHEN TO USE
 * Use to discard a draft journal entry.
 *
 * SEQUENCE DIAGRAM
 * @see ./__docs__/delete-journal-entry.sequence.md
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import eventValue from '@shared/values/events/event.vo';

import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';

import { IAppContextData } from '@app/context/types/app-context.types';
import IJournalEntryPersistenceAppService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';
import journalEntryMutationPolicy from '@app/journal-entry/policies/journal-entry-mutation.policy';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  eventBus: IEventBus;
  journalEntryPersistenceAppService: IJournalEntryPersistenceAppService;
  journalEntryRepo: IJournalEntryRepo;
}

export default function makeDeleteJournalEntryUsecase(deps: IDependencies) {
  return async (id: string): Promise<void> => {
    stringUtils.validateUUID(id, journalEntryError.InvalidJournalEntry);

    const { correlationId, idempotencyKey, accountingEntity } =
      deps.appContext.get(['accountingEntity']);

    const repoOptions = { correlationId, idempotencyKey };

    const storedEntry = await deps.journalEntryRepo.findById(
      id as TEntityId,
      repoOptions
    );

    const authorizedEntry = journalEntryMutationPolicy.validate({
      id,
      entry: storedEntry,
      accountingEntityId: accountingEntity.id,
    });

    const [deletedEntry, deleteEvent] =
      journalEntryEntity.delete(authorizedEntry);
    await deps.journalEntryPersistenceAppService.delete(
      {
        journalEntryId: deletedEntry.id,
        expectedVersion: authorizedEntry.version,
      },
      repoOptions
    );

    await deps.eventBus.publish(eventValue.enrich(deleteEvent, repoOptions));
  };
}
