import waitListMemberEntity from '@domain/user/entities/waitlist-member.entity';
import userValueObjectError from '@domain/user/errors/user-value-object.error';
import userError from '@domain/user/errors/user.error';
import { UWaitListFeature } from '@domain/user/types/waitlist-member.types';

const payload = {
  firstName: null,
  lastName: null,
  email: ' Member@Example.com ',
  feature: 'mvp' as const,
};

describe('waitListMemberEntity', () => {
  it('creates an immutable member with normalized email and nullable names', () => {
    const [member, events] = waitListMemberEntity.make(payload);
    expect(member).toEqual({
      ...payload,
      email: 'member@example.com',
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    expect(member.createdAt).toBe(member.updatedAt);
    expect(Object.isFrozen(member)).toBe(true);
    expect(Object.isFrozen(member.createdAt)).toBe(true);
    expect(events).toEqual([
      expect.objectContaining({
        type: 'domain:waitlist-member:created',
        data: member,
        occurredAt: expect.any(Date),
        enrichedAt: null,
      }),
    ]);
    expect(events[0].data).toBe(member);
    expect(Object.isFrozen(events[0])).toBe(true);
  });
  it('trims supplied names', () => {
    const [member] = waitListMemberEntity.make({
      ...payload,
      firstName: ' First ',
      lastName: ' Last ',
    });
    expect(member.firstName).toBe('First');
    expect(member.lastName).toBe('Last');
  });
  describe.each(['firstName', 'lastName'] as const)('%s', (field) => {
    it.each(['', ' ', 'x'.repeat(101)])(
      'rejects invalid supplied names %j',
      (name) => {
        expect(() =>
          waitListMemberEntity.make({ ...payload, [field]: name })
        ).toThrow(
          field === 'firstName'
            ? userError.InvalidFirstName
            : userError.InvalidLastName
        );
      }
    );
  });
  it('rejects unknown features through entity creation', () => {
    expect(() =>
      waitListMemberEntity.make({
        ...payload,
        feature: 'other' as UWaitListFeature,
      })
    ).toThrow(userError.InvalidWaitListFeature);
  });
  it('rejects invalid email', () => {
    expect(() =>
      waitListMemberEntity.make({ ...payload, email: 'invalid' })
    ).toThrow(userValueObjectError.InvalidFormat);
  });
});
