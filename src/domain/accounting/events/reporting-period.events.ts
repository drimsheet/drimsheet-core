import eventValue from '@shared/values/events/event.vo';

import { IReportingPeriod } from '@domain/accounting/types/reporting-period.types';

function created(entity: IReportingPeriod) {
  return eventValue.make({
    type: 'domain:accounting:reporting-period:created',
    data: entity,
  });
}

const reportingPeriodEvents = Object.freeze({
  created,
});

export default reportingPeriodEvents;
