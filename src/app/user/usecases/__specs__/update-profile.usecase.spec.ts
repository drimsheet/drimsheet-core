import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import repoError from '@shared/values/errors/repo.error';

import actorEntity from '@domain/user/entities/actor.entity';
import userEntity from '@domain/user/entities/user.entity';
import { EUserEvents } from '@domain/user/events/user.events';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { mockUserRepo } from '@app/user/contracts/__mocks__/user.repos.mock';
import makeUpdateAuthUserProfileUsecase from '@app/user/usecases/update-profile.usecase';

const [actor] = actorEntity.makeUser({
  email: 'user@example.com',
  displayName: 'First Last',
});
const [user] = userEntity.make({
  createdBy: actor.id,
  actorId: actor.id,
  email: actor.username,
  emailVerified: true,
  firstName: 'First',
  lastName: 'Last',
});
const correlationId = 'profile-update';
const usecase = makeUpdateAuthUserProfileUsecase({
  appContext: mockAppContext,
  userRepo: mockUserRepo,
  eventBus: mockEventBus,
});

describe('makeUpdateAuthUserProfileUsecase', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({ user, actor, correlationId });
    mockUserRepo.update.mockResolvedValue(undefined);
    mockEventBus.publish.mockResolvedValue(undefined);
  });

  afterEach(() => {
    expect(mockUserRepo.findById).not.toHaveBeenCalled();
  });

  it('persists a name update with attribution and publishes only after persistence', async () => {
    const response = await usecase({
      firstName: ' Updated ',
      lastName: 'Name',
    });
    expect(mockAppContext.get).toHaveBeenCalledWith(['user', 'actor']);
    const [updatedUser, options] = mockUserRepo.update.mock.calls[0];
    expect(updatedUser).toMatchObject({
      id: user.id,
      email: user.email,
      emailVerified: true,
      firstName: 'Updated',
      lastName: 'Name',
      version: 2,
    });
    expect(options).toMatchObject({
      expectedVersion: user.version,
      correlationId,
      history: {
        actorId: actor.id,
        entityId: user.id,
        entityVersion: 2,
        correlationId,
      },
    });
    expect(mockAppContext.set).toHaveBeenCalledWith({ user: updatedUser });
    expect(mockEventBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        type: EUserEvents.Updated,
        data: updatedUser,
        correlationId,
      }),
    ]);
    expect(mockUserRepo.update.mock.invocationCallOrder[0]).toBeLessThan(
      mockEventBus.publish.mock.invocationCallOrder[0]
    );
    expect(response).toEqual({
      id: user.id,
      email: user.email,
      emailVerified: true,
      firstName: 'Updated',
      lastName: 'Name',
      createdAt: user.createdAt,
      updatedAt: updatedUser.updatedAt,
    });
  });

  it('uses the context user version and preserves an omitted name', async () => {
    const [current] = userEntity.update(user, { lastName: 'Current' });
    mockAppContext.get.mockReturnValue({ user: current, actor, correlationId });
    const response = await usecase({ firstName: 'Updated' });
    expect(response.lastName).toBe('Current');
    expect(mockUserRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ version: 3 }),
      expect.objectContaining({ expectedVersion: 2 })
    );
  });

  it.each([{}, { firstName: ' First ', lastName: 'Last' }])(
    'does not persist, audit or publish unchanged updates',
    async (payload) => {
      const response = await usecase(payload);
      expect(response.updatedAt).toBe(user.updatedAt);
      expect(mockUserRepo.update).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
      expect(mockAppContext.set).not.toHaveBeenCalled();
    }
  );

  it('rejects invalid fields before reading or writing', async () => {
    await expect(usecase({ firstName: ' ' })).rejects.toThrow(
      'app_error_validation_error'
    );
    expect(mockUserRepo.findById).not.toHaveBeenCalled();
    expect(mockUserRepo.update).not.toHaveBeenCalled();
  });

  it.each([new repoError.VersionNotFound(), new Error('persistence failed')])(
    'propagates persistence failures without publishing or updating context',
    async (error) => {
      mockUserRepo.update.mockRejectedValue(error);
      await expect(usecase({ firstName: 'Updated' })).rejects.toBe(error);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
      expect(mockAppContext.set).not.toHaveBeenCalled();
    }
  );
});
