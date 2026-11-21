import {
  IReadRepoOptions,
  IVersionedRepoWriteOptions,
  IWriteRepoOptions,
} from '@shared/types/repo.types';

import { IUserAuth } from '@app/auth/types/auth.types';

export default interface IUserAuthRepo {
  create(userAuth: IUserAuth, options: IWriteRepoOptions): Promise<void>;
  findByUserId(
    userId: string,
    options: IReadRepoOptions
  ): Promise<IUserAuth | null>;
  update(
    userAuth: IUserAuth,
    options: IVersionedRepoWriteOptions
  ): Promise<void>;
}
