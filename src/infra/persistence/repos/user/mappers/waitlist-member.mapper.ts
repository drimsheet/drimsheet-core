import { InferInsertModel, InferSelectModel } from 'drizzle-orm';

import deepFreeze from '@shared/utils/deep-freeze';

import {
  IWaitListMember,
  UWaitListFeature,
} from '@domain/user/types/waitlist-member.types';

import { waitlistMembersInCore } from '@infra/config/drizzle/schema';

const waitListMemberMapper = {
  toRepo(
    member: IWaitListMember
  ): InferInsertModel<typeof waitlistMembersInCore> {
    return {
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      feature: member.feature,
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
    };
  },
  toDomain(
    member: InferSelectModel<typeof waitlistMembersInCore>
  ): IWaitListMember {
    return deepFreeze({
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      feature: member.feature as UWaitListFeature,
      createdAt: new Date(member.createdAt),
      updatedAt: new Date(member.updatedAt),
    });
  },
};

export default Object.freeze(waitListMemberMapper);
