import eventValue from '@shared/values/events/event.vo';

import { IWaitListMember } from '@domain/user/types/waitlist-member.types';

const EWaitListMemberEvents = {
  Created: 'domain:waitlist-member:created',
} as const;

function created(member: IWaitListMember) {
  return eventValue.make({
    type: EWaitListMemberEvents.Created,
    data: member,
  });
}

export default Object.freeze({ created });
