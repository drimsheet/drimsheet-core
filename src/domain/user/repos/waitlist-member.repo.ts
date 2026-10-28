import { IReadRepoOptions, IWriteRepoOptions } from '@shared/types/repo.types';

import {
  IWaitListMember,
  UWaitListFeature,
} from '@domain/user/types/waitlist-member.types';

export default interface IWaitListMemberRepo {
  create(member: IWaitListMember, options: IWriteRepoOptions): Promise<void>;

  findByEmailAndFeature(
    email: string,
    feature: UWaitListFeature,
    options: IReadRepoOptions
  ): Promise<IWaitListMember | null>;
}
