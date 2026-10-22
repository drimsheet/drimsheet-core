import eventValue from '@shared/values/events/event.vo';

import { IAccountingPeriod } from '@domain/accounting/types/accounting-period.types';

function created(entity: IAccountingPeriod) {
  return eventValue.make({
    type: 'domain:accounting:accounting-period:created',
    data: entity,
  });
}

const accountingPeriodEvents = Object.freeze({
  created,
});

export default accountingPeriodEvents;
