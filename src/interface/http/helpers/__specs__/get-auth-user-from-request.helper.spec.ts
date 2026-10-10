import { Request } from 'express';

import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';

import { IUser } from '@domain/user/types/user.types';

import mockTokenAppService from '@app/auth/contracts/__mocks__/token-service.mock';
import { mockUserRepo } from '@app/user/contracts/__mocks__/user.repos.mock';

import getAuthUserFromRequest from '@interface/http/helpers/get-auth-user-from-request.helper';

describe('getAuthUserFromRequest', () => {
  const userId = 'user-id' as TEntityId;
  const repoOptions: IReadRepoOptions = {
    correlationId: 'request-correlation-id',
  };

  let mockReq: Partial<Request>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = { headers: {} };
  });

  function getUserFromRequest() {
    return getAuthUserFromRequest(
      mockReq as Request,
      mockTokenAppService,
      mockUserRepo,
      repoOptions
    );
  }

  it('returns null if the authorization header is missing', async () => {
    await expect(getUserFromRequest()).resolves.toBeNull();
    expect(mockTokenAppService.getAuthUser).not.toHaveBeenCalled();
  });

  it('returns null if the bearer token is missing', async () => {
    mockReq.headers = { authorization: 'Bearer ' };

    await expect(getUserFromRequest()).resolves.toBeNull();
    expect(mockTokenAppService.getAuthUser).not.toHaveBeenCalled();
  });

  it('returns null for the wrong authorization scheme', async () => {
    mockReq.headers = { authorization: 'Basic valid-token' };

    await expect(getUserFromRequest()).resolves.toBeNull();
    expect(mockTokenAppService.getAuthUser).not.toHaveBeenCalled();
  });

  it('returns null if the authorization header has extra segments', async () => {
    mockReq.headers = { authorization: 'Bearer valid-token extra' };

    await expect(getUserFromRequest()).resolves.toBeNull();
    expect(mockTokenAppService.getAuthUser).not.toHaveBeenCalled();
  });

  it('accepts additional spacing around a valid bearer token', async () => {
    const user = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: userId,
    } as IUser;
    mockReq.headers = { authorization: '  Bearer   valid-token  ' };
    mockTokenAppService.getAuthUser.mockResolvedValue({ id: userId });
    mockUserRepo.findById.mockResolvedValue(user);

    await expect(getUserFromRequest()).resolves.toBe(user);
    expect(mockTokenAppService.getAuthUser).toHaveBeenCalledWith('valid-token');
  });

  it('propagates token decoding errors', async () => {
    const error = new Error('token expired');
    mockReq.headers = { authorization: 'Bearer invalid-token' };
    mockTokenAppService.getAuthUser.mockRejectedValue(error);

    await expect(getUserFromRequest()).rejects.toThrow(error);
  });

  it('forwards the supplied repo options when loading the user', async () => {
    const user = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: userId,
    } as IUser;
    mockReq.headers = { authorization: 'Bearer valid-token' };
    mockTokenAppService.getAuthUser.mockResolvedValue({ id: userId });
    mockUserRepo.findById.mockResolvedValue(user);

    await expect(getUserFromRequest()).resolves.toBe(user);
    expect(mockUserRepo.findById).toHaveBeenCalledWith(userId, repoOptions);
  });
});
