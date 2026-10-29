import deepFreeze from '@shared/utils/deep-freeze';
import stringUtils from '@shared/utils/string';
import { IEvent } from '@shared/values/events/types/event.types';

import waitListMemberValidation from '@domain/user/entities/validations/waitlist-member.validation';
import userError from '@domain/user/errors/user.error';
import waitListMemberEvents from '@domain/user/events/waitlist-member.events';
import { IWaitListMember } from '@domain/user/types/waitlist-member.types';
import emailValue from '@domain/user/values/email.vo';

function make(
  payload: Omit<IWaitListMember, 'createdAt' | 'updatedAt'>
): [IWaitListMember, IEvent<IWaitListMember>[]] {
  waitListMemberValidation.validateFeature(payload.feature);

  const timestamp = new Date();

  const firstName =
    payload.firstName !== null
      ? stringUtils.sanitizeAndValidate(
          payload.firstName,
          { min: 1, max: 100 },
          userError.InvalidFirstName
        )
      : null;

  const lastName =
    payload.lastName !== null
      ? stringUtils.sanitizeAndValidate(
          payload.lastName,
          { min: 1, max: 100 },
          userError.InvalidLastName
        )
      : null;

  const member: IWaitListMember = deepFreeze({
    firstName,
    lastName,
    email: emailValue.make(payload.email),
    feature: payload.feature,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const event = waitListMemberEvents.created(member);

  return [member, [event]];
}

export default Object.freeze({ make, ...waitListMemberValidation });
