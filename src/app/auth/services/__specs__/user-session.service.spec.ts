import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import { IUser } from '@domain/user/types/user.types';

import mockTokenAppService from '@app/auth/contracts/__mocks__/token-service.mock';
import makeUserSessionAppService from '@app/auth/services/user-session.service';

jest.mock('@shared/utils/uuid-generator', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('userSessionAppService', () => {
  const userId = '123e4567-e89b-42d3-a456-426614174000' as TEntityId;
  const sessionId = '123e4567-e89b-42d3-a456-426614174001' as TEntityId;
  const user: IUser = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: userId,
    email: 'john@example.com',
    emailVerified: true,
    firstName: 'John',
    lastName: 'Doe',
    version: 1,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
  };
  const mockedGenerateUUID = jest.mocked(generateUUID);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-04-01T00:00:00.000Z'));
    mockedGenerateUUID.mockReturnValue(sessionId);
    mockTokenAppService.generateAccessToken.mockResolvedValue('access-token');
    mockTokenAppService.generateRefreshToken.mockResolvedValue('refresh-token');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('prepares credentials and an immutable session record', async () => {
    const service = makeUserSessionAppService({
      tokenAppService: mockTokenAppService,
    });

    const prepared = await service.prepare(user);

    expect(mockTokenAppService.generateAccessToken).toHaveBeenCalledWith(user);
    expect(mockTokenAppService.generateRefreshToken).toHaveBeenCalledWith(user);
    expect(prepared).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      userSession: {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: sessionId,
        userId,
        refreshToken: 'refresh-token',
        lastLoginAt: new Date('2026-04-01T00:00:00.000Z'),
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
      },
      priorClientSession: null,
    });
    expect(Object.isFrozen(prepared)).toBe(true);
    expect(Object.isFrozen(prepared.userSession)).toBe(true);
  });

  it('uses the decoded owner for a prior client session', async () => {
    const priorUserId = '123e4567-e89b-42d3-a456-426614174002' as TEntityId;
    mockTokenAppService.verifyRefreshToken.mockReturnValue({ id: priorUserId });
    const service = makeUserSessionAppService({
      tokenAppService: mockTokenAppService,
    });

    const prepared = await service.prepare(user, 'prior-refresh-token');

    expect(prepared.priorClientSession).toEqual({
      userId: priorUserId,
      refreshToken: 'prior-refresh-token',
    });
  });

  it('falls back to the current user for an invalid prior client token', async () => {
    mockTokenAppService.verifyRefreshToken.mockImplementation(() => {
      throw new Error('invalid token');
    });
    const service = makeUserSessionAppService({
      tokenAppService: mockTokenAppService,
    });

    const prepared = await service.prepare(user, 'invalid-refresh-token');

    expect(prepared.priorClientSession).toEqual({
      userId,
      refreshToken: 'invalid-refresh-token',
    });
  });

  it('rejects when access-token generation fails', async () => {
    mockTokenAppService.generateAccessToken.mockRejectedValue(
      new Error('access generation failed')
    );
    const service = makeUserSessionAppService({
      tokenAppService: mockTokenAppService,
    });

    await expect(service.prepare(user)).rejects.toThrow(
      'access generation failed'
    );

    expect(mockTokenAppService.generateRefreshToken).not.toHaveBeenCalled();
    expect(mockedGenerateUUID).not.toHaveBeenCalled();
  });

  it('rejects when refresh-token generation fails', async () => {
    mockTokenAppService.generateRefreshToken.mockRejectedValue(
      new Error('refresh generation failed')
    );
    const service = makeUserSessionAppService({
      tokenAppService: mockTokenAppService,
    });

    await expect(service.prepare(user)).rejects.toThrow(
      'refresh generation failed'
    );

    expect(mockedGenerateUUID).not.toHaveBeenCalled();
  });
});
