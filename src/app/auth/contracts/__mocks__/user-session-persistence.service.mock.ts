import IUserSessionPersistenceAppService from '@app/auth/contracts/user-session-persistence.service.contract';

const mockUserSessionPersistenceAppService: jest.Mocked<IUserSessionPersistenceAppService> =
  {
    replaceClientSession: jest.fn(),
    rotateSession: jest.fn(),
    replaceAllUserSessions: jest.fn(),
  };

export default mockUserSessionPersistenceAppService;
