import { TEntityId } from '@shared/types/uuid';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import { EAccountingEntityType } from '@domain/accounting/types/accounting-entity.types';
import { IUser } from '@domain/user/types/user.types';

import { mockAccountingEntityRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import accountingAppError from '@app/accounting/errors/accounting.error';
import makeGetCurrentAccountingEntityUseCase from '@app/accounting/usecases/get-active-accounting-entity.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { mockUserPreferencesRepo } from '@app/user/contracts/repos/__mocks__/user-preferences.repo.mock';
import { IUserPreferences } from '@app/user/types/user-preferences.types';

describe('getActiveAccountingEntityUseCase', () => {
  const correlationId = 'test-corr-id';
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;

  const [mockAccountingEntity] = accountingEntityEntity.make({
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    name: 'Test Accounting Entity',
    type: EAccountingEntityType.Individual,
    ownerId: mockUserId,
    functionalCurrencyCode: 'USD',
    jurisdictionCode: 'US',
  });
  const mockPreferences: IUserPreferences = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    userId: mockUserId,
    lastActiveAccountingEntityId: mockAccountingEntity.id,
    appPreferences: { appUsageMode: 'non_power_user' },
    createdAt: new Date('2026-08-13T00:00:00.000Z'),
    updatedAt: new Date('2026-08-13T00:00:00.000Z'),
  };

  const getUseCase = () =>
    makeGetCurrentAccountingEntityUseCase({
      appContext: mockAppContext,
      accountingEntityRepo: mockAccountingEntityRepo,
      userPreferencesRepo: mockUserPreferencesRepo,
    });

  beforeEach(() => {
    jest.clearAllMocks();

    mockAppContext.get.mockReturnValue({
      correlationId,
      user: {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: mockUserId,
      } as IUser,
    } as unknown as ReturnType<typeof mockAppContext.get>);
    mockUserPreferencesRepo.findById
      .mockReset()
      .mockResolvedValue(mockPreferences);
    mockAccountingEntityRepo.findByIdAndUserId
      .mockReset()
      .mockResolvedValue(mockAccountingEntity);
  });

  it('should return the persisted active accounting entity owned by the user', async () => {
    const result = await getUseCase()();

    expect(result).toBe(mockAccountingEntity);
    expect(mockUserPreferencesRepo.findById).toHaveBeenCalledWith(mockUserId, {
      correlationId,
    });
    expect(mockAccountingEntityRepo.findByIdAndUserId).toHaveBeenCalledWith(
      mockAccountingEntity.id,
      mockUserId,
      { correlationId }
    );
  });

  it('throws when user preferences do not exist', async () => {
    mockUserPreferencesRepo.findById.mockResolvedValue(null);

    await expect(getUseCase()()).rejects.toThrow(
      accountingAppError.ActiveEntityNotFound
    );

    expect(mockAccountingEntityRepo.findByIdAndUserId).not.toHaveBeenCalled();
  });

  it('throws when no active accounting entity is selected', async () => {
    mockUserPreferencesRepo.findById.mockResolvedValue({
      ...mockPreferences,
      lastActiveAccountingEntityId: null,
    });

    await expect(getUseCase()()).rejects.toThrow(
      accountingAppError.ActiveEntityNotFound
    );

    expect(mockAccountingEntityRepo.findByIdAndUserId).not.toHaveBeenCalled();
  });

  it('throws when the persisted entity is missing or inaccessible', async () => {
    mockAccountingEntityRepo.findByIdAndUserId.mockResolvedValue(null);

    await expect(getUseCase()()).rejects.toThrow(
      accountingAppError.ActiveEntityNotFound
    );

    expect(mockAccountingEntityRepo.findByIdAndUserId).toHaveBeenCalledWith(
      mockAccountingEntity.id,
      mockUserId,
      { correlationId }
    );
  });
});
