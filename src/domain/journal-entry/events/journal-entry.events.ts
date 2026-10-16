import eventValue from '@shared/values/events/event.vo';

import { IJournalEntry } from '@domain/journal-entry/types/journal-entry.types';

export const EJournalEntryEvent = {
  Created: 'domain:journal-entry:created',
  Updated: 'domain:journal-entry:updated',
  Voided: 'domain:journal-entry:voided',
  Archived: 'domain:journal-entry:archived',
  Deleted: 'domain:journal-entry:deleted',
} as const;

export type UJournalEntryEvent =
  (typeof EJournalEntryEvent)[keyof typeof EJournalEntryEvent];

function makeJournalEntryCreatedEvent(payload: IJournalEntry) {
  return eventValue.make<IJournalEntry>({
    type: EJournalEntryEvent.Created,
    data: payload,
  });
}

function makeJournalEntryVoidedEvent(payload: IJournalEntry) {
  return eventValue.make<IJournalEntry>({
    type: EJournalEntryEvent.Voided,
    data: payload,
  });
}

function makeJournalEntryUpdatedEvent(payload: IJournalEntry) {
  return eventValue.make<IJournalEntry>({
    type: EJournalEntryEvent.Updated,
    data: payload,
  });
}

function makeJournalEntryArchivedEvent(payload: IJournalEntry) {
  return eventValue.make<IJournalEntry>({
    type: EJournalEntryEvent.Archived,
    data: payload,
  });
}

function makeJournalEntryDeletedEvent(payload: IJournalEntry) {
  return eventValue.make<IJournalEntry>({
    type: EJournalEntryEvent.Deleted,
    data: payload,
  });
}

const journalEntryEvents = Object.freeze({
  created: makeJournalEntryCreatedEvent,
  updated: makeJournalEntryUpdatedEvent,
  voided: makeJournalEntryVoidedEvent,
  archived: makeJournalEntryArchivedEvent,
  deleted: makeJournalEntryDeletedEvent,
});

export default journalEntryEvents;
