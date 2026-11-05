import { and, eq } from 'drizzle-orm';

import IWaitListMemberRepo from '@domain/user/repos/waitlist-member.repo';

import { waitlistMembersInCore } from '@infra/config/drizzle/schema';
import getDbQueryHelper from '@infra/persistence/helpers/get-db-query.helper';
import waitListMemberMapper from '@infra/persistence/repos/user/mappers/waitlist-member.mapper';

const waitListMemberRepo: IWaitListMemberRepo = {
  async create(member, options) {
    await getDbQueryHelper(options)
      .insert(waitlistMembersInCore)
      .values(waitListMemberMapper.toRepo(member));
  },
  async findByEmailAndFeature(email, feature, options) {
    const [member] = await getDbQueryHelper(options)
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
