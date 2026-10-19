import { userEventsRegistry } from '@infra/ioc/handlers/user';
import messaging from '@infra/messaging';

export default function eventsRegistry() {
  const events = {
    ...userEventsRegistry,
  };

  Object.entries(events).forEach(([eventType, handler]) => {
    messaging.eventBus.subscribe(eventType, handler);
  });
}
