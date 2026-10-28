import userError from '@domain/user/errors/user.error';
import {
  EWaitListFeature,
  UWaitListFeature,
} from '@domain/user/types/waitlist-member.types';

function validateFeature(feature: UWaitListFeature) {
  const isInvalidFeature = !Object.values(EWaitListFeature).includes(feature);
  if (isInvalidFeature) {
    throw new userError.InvalidWaitListFeature();
  }
}

export default Object.freeze({ validateFeature });
