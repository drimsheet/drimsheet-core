import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import actorEntity from '@domain/user/entities/actor.entity';
import { IUser } from '@domain/user/types/user.types';

import { mockAccountingEntityRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import accountingAppError from '@app/accounting/errors/accounting.error';
import makeSwitchAccountingEntityUsecase from '@app/accounting/usecases/switch-accounting-entity.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import mockUserPreferencesAppService from '@app/user/contracts/__mocks__/user-preferences.service.mock';

const actor = {
  ...actorEntity.makeUser({
    email: 'actor@example.com',
    displayName: 'Actor',
  })[0],
  id: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
};

describe('switchAccountingEntityUsecase', () => {
  const correlationId = 'test-correlation-id';
  const userId = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
  const currentAccountingEntity: IAccountingEntity = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: '123e4567-e89b-12d3-a456-426614174001' as TEntityId,
    ownerId: userId,
    name: 'Current Entity',
    type: 'individual',
    functionalCurrencyCode: 'USD',
    jurisdictionCode: 'US',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  };
  const targetAccountingEntity: IAccountingEntity = {
    ...currentAccountingEntity,
    id: '123e4567-e89b-12d3-a456-426614174002' as TEntityId,
    name: 'Target Entity',
  };

  const getUsecase = () =>
    makeSwitchAccountingEntityUsecase({
      appContext: mockAppContext,
      accountingEntityRepo: mockAccountingEntityRepo,
      userPreferencesAppService: mockUserPreferencesAppService,
    });

  beforeEach(() => {
    jest.clearAllMocks();

    mockAppContext.get.mockReset().mockReturnValue({
      actor,
      user: {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        actorId: 'b2222222-2222-4222-8222-222222222222' as TEntityId,
        id: userId,
      } as IUser,
      accountingEntity: currentAccountingEntity,
      correlationId,
    } as ReturnType<typeof mockAppContext.get>);
    mockAppContext.set.mockReset();
    mockAccountingEntityRepo.findByIdAndUserId
      .mockReset()
      .mockResolvedValue(targetAccountingEntity);
    mockUserPreferencesAppService.update.mockReset().mockResolvedValue({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      userId,
      lastActiveAccountingEntityId: targetAccountingEntity.id,
      appPreferences: { appUsageMode: 'non_power_user' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it('switches the request context to an owned accounting entity', async () => {
    const result = await getUsecase()({
      accountingEntityId: targetAccountingEntity.id,
    });

    expect(result).toBe(targetAccountingEntity);
    expect(mockAccountingEntityRepo.findByIdAndUserId).toHaveBeenCalledWith(
      targetAccountingEntity.id,
      userId,
      { correlationId }
    );
    expect(mockUserPreferencesAppService.update).toHaveBeenCalledWith(
      {
        userId,
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        lastActiveAccountingEntityId: targetAccountingEntity.id,
      },
      { correlationId }
    );
    expect(mockAppContext.set).toHaveBeenCalledWith({
      accountingEntity: targetAccountingEntity,
    });
    expect(
      mockUserPreferencesAppService.update.mock.invocationCallOrder[0]
    ).toBeLessThan(mockAppContext.set.mock.invocationCallOrder[0]);
  });

  it('resolves and sets an entity that is already current', async () => {
    mockAppContext.get.mockReturnValue({
      actor,
      user: {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        actorId: 'b2222222-2222-4222-8222-222222222222' as TEntityId,
        id: userId,
      } as IUser,
      accountingEntity: targetAccountingEntity,
      correlationId,
    } as ReturnType<typeof mockAppContext.get>);

    const result = await getUsecase()({
      accountingEntityId: targetAccountingEntity.id,
    });

    expect(result).toBe(targetAccountingEntity);
    expect(mockAccountingEntityRepo.findByIdAndUserId).toHaveBeenCalledTimes(1);
    expect(mockAppContext.set).toHaveBeenCalledWith({
      accountingEntity: targetAccountingEntity,
    });
  });

  it('rejects malformed input before reading or mutating dependencies', async () => {
    await expect(
      getUsecase()({ accountingEntityId: 'not-a-uuid' })
    ).rejects.toThrow(appError.UnprocessableEntity);

    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockAccountingEntityRepo.findByIdAndUserId).not.toHaveBeenCalled();
    expect(mockUserPreferencesAppService.update).not.toHaveBeenCalled();
    expect(mockAppContext.set).not.toHaveBeenCalled();
  });

  it('does not disclose an unknown or inaccessible accounting entity', async () => {
    mockAccountingEntityRepo.findByIdAndUserId.mockResolvedValue(null);

    await expect(
      getUsecase()({ accountingEntityId: targetAccountingEntity.id })
    ).rejects.toThrow(accountingAppError.ActiveEntityNotFound);

    expect(mockAccountingEntityRepo.findByIdAndUserId).toHaveBeenCalledWith(
      targetAccountingEntity.id,
      userId,
      { correlationId }
    );
    expect(mockUserPreferencesAppService.update).not.toHaveBeenCalled();
    expect(mockAppContext.set).not.toHaveBeenCalled();
  });

  it('does not update context when preference persistence fails', async () => {
    mockUserPreferencesAppService.update.mockRejectedValueOnce(
      new Error('preference persistence failed')
    );

    await expect(
      getUsecase()({ accountingEntityId: targetAccountingEntity.id })
    ).rejects.toThrow('preference persistence failed');

    expect(mockAppContext.set).not.toHaveBeenCalled();
  });
});
