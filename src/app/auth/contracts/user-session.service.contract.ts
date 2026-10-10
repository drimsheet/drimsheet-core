import { TEntityId } from '@shared/types/uuid';

import { IUser } from '@domain/user/types/user.types';

import { IUserSession } from '@app/auth/contracts/auth.types';

export interface IUserSessionReference {
  userId: TEntityId;
  refreshToken: string;
}

export interface IPreparedUserSession {
  accessToken: string;
  refreshToken: string;
  userSession: IUserSession;
  priorClientSession: IUserSessionReference | null;
}

export default interface IUserSessionAppService {
  prepare(
    user: IUser,
    priorClientRefreshToken?: string | null
  ): Promise<IPreparedUserSession>;
}
