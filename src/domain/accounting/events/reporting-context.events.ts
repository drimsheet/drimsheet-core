import eventValue from '@shared/values/events/event.vo';

import { IReportingContext } from '@domain/accounting/types/context.types';

export const EReportingContextEvents = {
  Created: 'domain:accounting:reporting-context:created',
  Updated: 'domain:accounting:reporting-context:updated',
} as const;

function makeCreatedEvent(params: IReportingContext) {
  return eventValue.make<IReportingContext>({
    type: EReportingContextEvents.Created,
    data: params,
  });
}

const reportingContextEvents = Object.freeze({
  created: makeCreatedEvent,
  updated: (context: IReportingContext) =>
    eventValue.make<IReportingContext>({
      type: EReportingContextEvents.Updated,
      data: context,
    }),
});

export default reportingContextEvents;
