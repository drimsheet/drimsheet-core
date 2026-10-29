import { and, eq } from 'drizzle-orm';

import waitListMemberEntity from '@domain/user/entities/waitlist-member.entity';

import { waitlistMembersInCore } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import waitListMemberMapper from '@infra/persistence/repos/user/mappers/waitlist-member.mapper';
import waitListMemberRepo from '@infra/persistence/repos/user/waitlist-member.repo.impl';

jest.mock('@infra/persistence/helpers/get-db-query');

const [member] = waitListMemberEntity.make({
  firstName: null,
  lastName: null,
  email: 'member@example.com',
  feature: 'mvp',
});
const options = { correlationId: 'waitlist' };
const query = {
  insert: jest.fn(),
  values: jest.fn(),
  select: jest.fn(),
  from: jest.fn(),
  where: jest.fn(),
  limit: jest.fn(),
};

describe('waitListMemberRepo', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    query.values.mockResolvedValue({ rowCount: 1 });
    for (const method of ['insert', 'select', 'from', 'where'] as const) {
      query[method].mockReturnValue(query);
    }
    jest
      .mocked(getDbQuery)
      .mockReturnValue(query as unknown as ReturnType<typeof getDbQuery>);
  });
  it('inserts the member and resolves without a return value', async () => {
    await expect(
      waitListMemberRepo.create(member, options)
    ).resolves.toBeUndefined();
    expect(getDbQuery).toHaveBeenCalledWith(options);
    expect(query.insert).toHaveBeenCalledWith(waitlistMembersInCore);
    expect(query.values).toHaveBeenCalledWith(
      waitListMemberMapper.toRepo(member)
    );
  });
  it('finds and maps membership by both fields', async () => {
    query.limit.mockResolvedValue([
      { id: 1, ...waitListMemberMapper.toRepo(member) },
    ]);
    expect(
      await waitListMemberRepo.findByEmailAndFeature(
        member.email,
        member.feature,
        options
      )
    ).toEqual(member);
    expect(query.from).toHaveBeenCalledWith(waitlistMembersInCore);
    expect(query.where).toHaveBeenCalledWith(
      and(
        eq(waitlistMembersInCore.email, member.email),
        eq(waitlistMembersInCore.feature, member.feature)
      )
    );
    expect(query.limit).toHaveBeenCalledWith(1);
  });
  it('returns null for missing membership', async () => {
    query.limit.mockResolvedValue([]);
    expect(
      await waitListMemberRepo.findByEmailAndFeature(
        member.email,
        member.feature,
        options
      )
    ).toBeNull();
  });
  it('propagates storage failures', async () => {
    const failure = new Error('storage failed');
    query.values.mockRejectedValue(failure);
    await expect(waitListMemberRepo.create(member, options)).rejects.toBe(
      failure
    );
  });
});
