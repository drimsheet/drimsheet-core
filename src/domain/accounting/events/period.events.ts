import eventValue from '@shared/values/events/event.vo';

import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';

export const EPeriodEvents = {
  FiscalYearCreated: 'domain:accounting:period:fiscal-year:created',
} as const;

function makeFiscalYearCreatedEvent(params: IFiscalYear) {
  return eventValue.make<IFiscalYear>({
    type: EPeriodEvents.FiscalYearCreated,
    data: params,
  });
}

const periodEvents = Object.freeze({
  fiscalYearCreated: makeFiscalYearCreatedEvent,
});

export default periodEvents;
