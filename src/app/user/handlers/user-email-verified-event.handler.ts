import IAppContextService from '@shared/contracts/app-context.service.contract';
import IReporter from '@shared/contracts/reporter.contract';
import eventValue from '@shared/values/events/event.vo';
import { IEvent } from '@shared/values/events/types/event.types';

import { EUserEvents } from '@domain/user/events/user.events';
import { IUser } from '@domain/user/types/user.types';

import { IAppContextData } from '@app/context/types/app-context.types';

interface IDependencies {
  reporter: IReporter;
  appContext: IAppContextService<IAppContextData>;
}

function makeUserEmailVerifiedEventHandler(deps: IDependencies) {
  return async (event: IEvent<IUser>) => {
    eventValue.validateEventTypeMatch(event, EUserEvents.EmailVerified);

    // TODO: send welcome email https://linear.app/drimsheet/issue/PUR-20/create-and-send-welcome-emails
  };
}

export default makeUserEmailVerifiedEventHandler;
