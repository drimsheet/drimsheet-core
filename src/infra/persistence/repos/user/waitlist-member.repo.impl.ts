import { and, eq } from 'drizzle-orm';

import IWaitListMemberRepo from '@domain/user/repos/waitlist-member.repo';

import { waitlistMembersInCore } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import waitListMemberMapper from '@infra/persistence/repos/user/mappers/waitlist-member.mapper';

const waitListMemberRepo: IWaitListMemberRepo = {
  async create(member, options) {
    await getDbQuery(options)
      .insert(waitlistMembersInCore)
      .values(waitListMemberMapper.toRepo(member));
  },
  async findByEmailAndFeature(email, feature, options) {
    const [member] = await getDbQuery(options)
      .select()
      .from(waitlistMembersInCore)
      .where(
        and(
          eq(waitlistMembersInCore.email, email),
          eq(waitlistMembersInCore.feature, feature)
        )
      )
      .limit(1);
    if (!member) {
      return null;
    }
    return waitListMemberMapper.toDomain(member);
  },
};

export default waitListMemberRepo;
