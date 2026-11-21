import { IReadRepoOptions, IWriteRepoOptions } from '@shared/types/repo.types';

import { IUserSession } from '@app/auth/types/auth.types';

export default interface IUserSessionRepo {
  create(userSession: IUserSession, options: IWriteRepoOptions): Promise<void>;

  findByRefreshToken(
    userId: string,
    refreshToken: string,
    options: IReadRepoOptions
  ): Promise<IUserSession | null>;

  findAllByUserId(
    userId: string,
    options: IReadRepoOptions
  ): Promise<IUserSession[]>;

  delete(
    userId: string,
    refreshToken: string,
    options: IWriteRepoOptions
  ): Promise<boolean>;

  deleteAllByUserId(userId: string, options: IWriteRepoOptions): Promise<void>;
}
