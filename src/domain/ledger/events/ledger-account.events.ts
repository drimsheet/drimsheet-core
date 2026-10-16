import eventValue from '@shared/values/events/event.vo';

import { ILedgerAccount } from '@domain/ledger/types/ledger.types';

export const ELedgerAccountEvent = {
  Created: 'domain:ledger:account:created',
  Updated: 'domain:ledger:account:updated',
  Archived: 'domain:ledger:account:archived',
  Deleted: 'domain:ledger:account:deleted',
} as const;

export type ULedgerAccountEvent =
  (typeof ELedgerAccountEvent)[keyof typeof ELedgerAccountEvent];

function makeLedgerAccountCreatedEvent<T extends ILedgerAccount>(payload: T) {
  return eventValue.make<T>({
    type: ELedgerAccountEvent.Created,
    data: payload,
  });
}

function makeLedgerAccountUpdatedEvent<T extends ILedgerAccount>(payload: T) {
  return eventValue.make<T>({
    type: ELedgerAccountEvent.Updated,
    data: payload,
  });
}

function makeLedgerAccountArchivedEvent<T extends ILedgerAccount>(payload: T) {
  return eventValue.make<T>({
    type: ELedgerAccountEvent.Archived,
    data: payload,
  });
}

function makeLedgerAccountDeletedEvent<T extends ILedgerAccount>(payload: T) {
  return eventValue.make<T>({
    type: ELedgerAccountEvent.Deleted,
    data: payload,
  });
}

const ledgerAccountEvents = Object.freeze({
  makeCreated: makeLedgerAccountCreatedEvent,
  updated: makeLedgerAccountUpdatedEvent,
  archived: makeLedgerAccountArchivedEvent,
  deleted: makeLedgerAccountDeletedEvent,
});

export default ledgerAccountEvents;
