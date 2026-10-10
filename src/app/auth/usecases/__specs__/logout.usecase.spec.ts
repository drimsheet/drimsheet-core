import { TEntityId } from '@shared/types/uuid';

import userEntity from '@domain/user/entities/user.entity';

import mockTokenAppService from '@app/auth/contracts/__mocks__/token-service.mock';
import mockUserSessionRepo from '@app/auth/contracts/__mocks__/user-session.repo.mock';
import authError from '@app/auth/errors/auth.error';
import makeLogoutUseCase from '@app/auth/usecases/logout.usecase';
import mockAppContext, {
  mockClientSession,
} from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';

describe('makeLogoutUseCase', () => {
  const correlationId = '854e4567-e89b-42d3-a456-426614174001';

  const [mockUser] = userEntity.make({
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    email: 'johndoe@example.com',
    emailVerified: true,
    firstName: 'John',
    lastName: 'Doe',
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAppContext.get.mockReset().mockReturnValue({
      clientSession: mockClientSession,
      correlationId,
    } as unknown as IAppContextData);
    mockTokenAppService.verifyRefreshToken.mockReturnValue({
      id: mockUser.id,
    });
  });

  const getUseCase = () =>
    makeLogoutUseCase({
      reqContext: mockAppContext,
      tokenAppService: mockTokenAppService,
      userSessionRepo: mockUserSessionRepo,
    });

  it('should delete a valid refresh-token session before clearing the cookie', async () => {
    mockClientSession.getRefreshToken.mockReturnValue('valid-refresh-token');
    mockUserSessionRepo.delete.mockResolvedValue(true);

    const usecase = getUseCase();
    await usecase();

    expect(mockTokenAppService.verifyRefreshToken).toHaveBeenCalledWith(
      'valid-refresh-token'
    );
    expect(mockUserSessionRepo.delete).toHaveBeenCalledWith(
      mockUser.id,
      'valid-refresh-token',
      { correlationId }
    );
    expect(mockClientSession.clearRefreshToken).toHaveBeenCalled();
    expect(mockUserSessionRepo.delete.mock.invocationCallOrder[0]).toBeLessThan(
      mockClientSession.clearRefreshToken.mock.invocationCallOrder[0]
    );
  });

  it('should clear the cookie without verification when no token is present', async () => {
    mockClientSession.getRefreshToken.mockReturnValue(null);

    const usecase = getUseCase();
    await usecase();

    expect(mockTokenAppService.verifyRefreshToken).not.toHaveBeenCalled();
    expect(mockUserSessionRepo.delete).not.toHaveBeenCalled();
    expect(mockClientSession.clearRefreshToken).toHaveBeenCalled();
  });

  it.each([
    ['invalid', new authError.InvalidToken()],
    ['expired', new authError.ExpiredToken()],
  ])(
    'should clear the cookie when the refresh token is %s',
    async (_, error) => {
      mockClientSession.getRefreshToken.mockReturnValue(
        'unusable-refresh-token'
      );
      mockTokenAppService.verifyRefreshToken.mockImplementation(() => {
        throw error;
      });

      const usecase = getUseCase();
      await usecase();

      expect(mockTokenAppService.verifyRefreshToken).toHaveBeenCalledWith(
        'unusable-refresh-token'
      );
      expect(mockUserSessionRepo.delete).not.toHaveBeenCalled();
      expect(mockClientSession.clearRefreshToken).toHaveBeenCalled();
    }
  );

  it('should clear the cookie when the valid token session is already absent', async () => {
    mockClientSession.getRefreshToken.mockReturnValue('valid-refresh-token');
    mockUserSessionRepo.delete.mockResolvedValue(false);

    const usecase = getUseCase();
    await usecase();

    expect(mockUserSessionRepo.delete).toHaveBeenCalledWith(
      mockUser.id,
      'valid-refresh-token',
      { correlationId }
    );
    expect(mockClientSession.clearRefreshToken).toHaveBeenCalled();
  });

  it('should propagate unexpected verification failures without clearing the cookie', async () => {
    mockClientSession.getRefreshToken.mockReturnValue('error-refresh-token');
    const error = new Error('Some error');
    mockTokenAppService.verifyRefreshToken.mockImplementation(() => {
      throw error;
    });

    const usecase = getUseCase();
    await expect(usecase()).rejects.toBe(error);

    expect(mockTokenAppService.verifyRefreshToken).toHaveBeenCalledWith(
      'error-refresh-token'
    );
    expect(mockUserSessionRepo.delete).not.toHaveBeenCalled();
    expect(mockClientSession.clearRefreshToken).not.toHaveBeenCalled();
  });

  it('should propagate persistence failures without clearing the cookie', async () => {
    mockClientSession.getRefreshToken.mockReturnValue('valid-refresh-token');
    const error = new Error('Database unavailable');
    mockUserSessionRepo.delete.mockRejectedValue(error);

    const usecase = getUseCase();
    await expect(usecase()).rejects.toBe(error);

    expect(mockUserSessionRepo.delete).toHaveBeenCalledWith(
      mockUser.id,
      'valid-refresh-token',
      { correlationId }
    );
    expect(mockClientSession.clearRefreshToken).not.toHaveBeenCalled();
  });
});
