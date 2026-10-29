import { joinWaitListDtoSchema } from '@app/user/dtos/waitlist-member/waitlist-member.dto.validation';

const payload = { email: 'member@example.com', feature: 'mvp' };

describe('joinWaitListDtoSchema', () => {
  it.each([
    {},
    { firstName: null, lastName: null },
    { firstName: 'First', lastName: 'Last' },
  ])('accepts optional and nullable names %j', (names) => {
    expect(
      joinWaitListDtoSchema.safeParse({ ...payload, ...names }).success
    ).toBe(true);
  });
  it.each([
    { email: 'invalid' },
    { email: 42 },
    { email: 'a'.repeat(255) + '@example.com' },
    { feature: 'other' },
    { feature: null },
    { firstName: '' },
    { firstName: ' ' },
    { firstName: 'a'.repeat(101) },
    { lastName: '' },
    { lastName: 42 },
    { lastName: 'a'.repeat(101) },
    { extra: true },
  ])('rejects malformed input %j', (invalid) => {
    expect(
      joinWaitListDtoSchema.safeParse({ ...payload, ...invalid }).success
    ).toBe(false);
  });
});
