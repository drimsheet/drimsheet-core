import waitListMemberValidation from '@domain/user/entities/validations/waitlist-member.validation';
import userError from '@domain/user/errors/user.error';
import { UWaitListFeature } from '@domain/user/types/waitlist-member.types';

describe('waitListMemberValidation', () => {
  it('accepts mvp', () => {
    expect(() => waitListMemberValidation.validateFeature('mvp')).not.toThrow();
  });
  it('rejects unknown features', () => {
    expect(() =>
      waitListMemberValidation.validateFeature('other' as UWaitListFeature)
    ).toThrow(userError.InvalidWaitListFeature);
  });
});
