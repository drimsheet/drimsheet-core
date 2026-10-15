import eventValue from '@shared/values/events/event.vo';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';

export const EAccountingEntityEvents = {
  Created: 'domain:accounting:entity:created',
  Updated: 'domain:accounting:entity:updated',
} as const;

function makeCreatedEvent(params: IAccountingEntity) {
  return eventValue.make<IAccountingEntity>({
    type: EAccountingEntityEvents.Created,
    data: params,
  });
}

const accountingEntityEvents = Object.freeze({
  created: makeCreatedEvent,
  updated: (entity: IAccountingEntity) =>
    eventValue.make<IAccountingEntity>({
      type: EAccountingEntityEvents.Updated,
      data: entity,
    }),
});

export default accountingEntityEvents;
