import waitListMemberEntity from '@domain/user/entities/waitlist-member.entity';

import waitListMemberMapper from '@infra/persistence/repos/user/mappers/waitlist-member.mapper';

describe('waitListMemberMapper', () => {
  it('round-trips every field and excludes the storage ID', () => {
    const [member] = waitListMemberEntity.make({
      firstName: 'First',
      lastName: 'Last',
      email: 'member@example.com',
      feature: 'mvp',
    });
    const stored = waitListMemberMapper.toRepo(member);
    expect(stored).toEqual({
      firstName: 'First',
      lastName: 'Last',
      email: member.email,
      feature: 'mvp',
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
    });
    const restored = waitListMemberMapper.toDomain({
      id: 1,
      firstName: stored.firstName ?? null,
      lastName: stored.lastName ?? null,
      email: stored.email,
      feature: stored.feature,
      createdAt: stored.createdAt!,
      updatedAt: stored.updatedAt!,
    });
    expect(restored).toEqual(member);
    expect(restored).not.toHaveProperty('id');
    expect(Object.isFrozen(restored)).toBe(true);
  });
});
