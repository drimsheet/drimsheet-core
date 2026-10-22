import eventValue from '@shared/values/events/event.vo';

import { IAccountingInterval } from '@domain/accounting/types/accounting-period.types';

function created(entity: IAccountingInterval) {
  return eventValue.make({
    type: 'domain:accounting:accounting-interval:created',
    data: entity,
  });
}

function updated(entity: IAccountingInterval) {
  return eventValue.make({
    type: 'domain:accounting:accounting-interval:updated',
    data: entity,
  });
}

const accountingIntervalEvents = Object.freeze({
  created,
  updated,
});

export default accountingIntervalEvents;
