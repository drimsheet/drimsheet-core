import { EUserEvents } from '@domain/user/events/user.events';

import makeUserEmailVerifiedEventHandler from '@app/user/handlers/user-email-verified-event.handler';

import observability from '@infra/observability';
import appContext from '@infra/services/app-context.service';

export const userEmailVerifiedEventHandler = makeUserEmailVerifiedEventHandler({
  reporter: observability.reporter,
  appContext: appContext,
});

const userEventsRegistry = {
  [EUserEvents.EmailVerified]: userEmailVerifiedEventHandler,
};

export { userEventsRegistry };
