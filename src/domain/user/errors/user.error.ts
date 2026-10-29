import { TErrorCause, TErrorKey, TErrorKeys } from '@shared/types/error.types';
import errorUtils from '@shared/utils/error';
import DomainError from '@shared/values/errors/domain.error';

type TErrorPrefix = TErrorKey<'user_error'>;

const EErrorKeys = {
  InvalidWaitListFeature: 'user_error_waitlist_feature_invalid',
  InvalidActorId: 'user_error_actor_id_invalid',
  InvalidCreatedBy: 'user_error_created_by_invalid',
  InvalidAction: 'user_error_action_invalid',
  InvalidId: 'user_error_id_invalid',
  InvalidDate: 'user_error_date_invalid',
  InvalidFirstName: 'user_error_first_name_invalid',
  InvalidLastName: 'user_error_last_name_invalid',
} as const satisfies TErrorKeys<'user_error'>;

type UUserError = (typeof EErrorKeys)[keyof typeof EErrorKeys];

class UserError<K extends TErrorPrefix = UUserError> extends DomainError<K> {
  constructor(key: K, cause?: TErrorCause) {
    super(key, cause);
    this.name = 'UserError';
  }
}

const userError = Object.freeze({
  Base: UserError,
  ...errorUtils.getMappedErrors(EErrorKeys, UserError),
});

export default userError;
