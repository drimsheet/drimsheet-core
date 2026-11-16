import { IWriteRepoOptions } from '@shared/types/repo.types';

import { IUserSessionReference } from '@app/auth/contracts/services/user-session.service.contract';
import { IUserSession } from '@app/auth/types/auth.types';

interface IReplaceClientSessionPayload {
  userSession: IUserSession;
  priorClientSession: IUserSessionReference | null;
}

interface IRotateSessionPayload {
  userSession: IUserSession;
  presentedSession: IUserSessionReference;
}

export default interface IUserSessionPersistenceAppService {
  replaceClientSession(
    payload: IReplaceClientSessionPayload,
    repoOptions: IWriteRepoOptions
  ): Promise<void>;
  rotateSession(
    payload: IRotateSessionPayload,
    repoOptions: IWriteRepoOptions
  ): Promise<boolean>;
  replaceAllUserSessions(
    userSession: IUserSession,
    repoOptions: IWriteRepoOptions
  ): Promise<void>;
}
