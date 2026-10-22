import eventValue from '@shared/values/events/event.vo';

import { IReportingInterval } from '@domain/accounting/types/reporting-period.types';

function created(entity: IReportingInterval) {
  return eventValue.make({
    type: 'domain:accounting:reporting-interval:created',
    data: entity,
  });
}

function updated(entity: IReportingInterval) {
  return eventValue.make({
    type: 'domain:accounting:reporting-interval:updated',
    data: entity,
  });
}

const reportingIntervalEvents = Object.freeze({
  created,
  updated,
});

export default reportingIntervalEvents;
