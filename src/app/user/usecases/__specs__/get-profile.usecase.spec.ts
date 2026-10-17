import { TEntityId } from '@shared/types/uuid';

import { IUser } from '@domain/user/types/user.types';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/types/app-context.types';
import userMapper from '@app/user/dtos/user/user.dto.mapper';
import makeGetAuthUserProfileUseCase from '@app/user/usecases/get-profile.usecase';

jest.mock('../../dtos/user/user.dto.mapper', () => ({
  toProfileDto: jest.fn(),
}));

describe('makeGetAuthUserProfileUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get user profile successfully', async () => {
    const mockUser = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'test-user-id' as TEntityId,
      email: 'test@example.com',
    } as IUser;

    mockAppContext.get.mockReturnValue({
      user: mockUser,
    } as IAppContextData);

    const mappedUser = { id: 'test-user-id', email: 'test@example.com' };
    (userMapper.toProfileDto as jest.Mock).mockReturnValue(mappedUser);

    const usecase = makeGetAuthUserProfileUseCase({
      appContext: mockAppContext,
    });
    const result = await usecase();

    expect(mockAppContext.get).toHaveBeenCalledTimes(1);
    expect(userMapper.toProfileDto).toHaveBeenCalledWith(mockUser);
    expect(result).toEqual(mappedUser);
  });

  it('should throw appError.Unauthorized if user is not in request context (undefined user)', async () => {
    mockAppContext.get.mockReturnValue({} as IAppContextData);

    const usecase = makeGetAuthUserProfileUseCase({
      appContext: mockAppContext,
    });

    await expect(usecase()).rejects.toThrow('app_error_unauthorized');
    expect(mockAppContext.get).toHaveBeenCalledTimes(1);
    expect(userMapper.toProfileDto).not.toHaveBeenCalled();
  });

  it('should throw appError.Unauthorized if user is empty object sentinel', async () => {
    mockAppContext.get.mockReturnValue({
      user: {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      } as IUser,
    } as IAppContextData);

    const usecase = makeGetAuthUserProfileUseCase({
      appContext: mockAppContext,
    });

    await expect(usecase()).rejects.toThrow('app_error_unauthorized');
    expect(mockAppContext.get).toHaveBeenCalledTimes(1);
    expect(userMapper.toProfileDto).not.toHaveBeenCalled();
  });

  it('should propagate error if mapper throws', async () => {
    const mockUser = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'test-user-id' as TEntityId,
      email: 'test@example.com',
    } as IUser;

    mockAppContext.get.mockReturnValue({
      user: mockUser,
    } as IAppContextData);

    (userMapper.toProfileDto as jest.Mock).mockImplementation(() => {
      throw new Error('Mapper failure');
    });

    const usecase = makeGetAuthUserProfileUseCase({
      appContext: mockAppContext,
    });

    await expect(usecase()).rejects.toThrow('Mapper failure');
    expect(mockAppContext.get).toHaveBeenCalledTimes(1);
    expect(userMapper.toProfileDto).toHaveBeenCalledWith(mockUser);
  });
});
