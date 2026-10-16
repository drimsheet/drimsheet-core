import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import { TEntityId } from '@shared/types/uuid';
import runtimeError from '@shared/values/errors/runtime.error';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';

import { mockAccountingEntityRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import accountingAppError from '@app/accounting/errors/accounting.error';
import makeArchiveAccountingEntityUsecase from '@app/accounting/usecases/archive-accounting-entity.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { mockUserPreferencesRepo } from '@app/user/contracts/__mocks__/user.repos.mock';

const actorId = 'a1111111-1111-4111-8111-111111111111' as TEntityId;
const [current] = accountingEntityEntity.make({
  createdBy: actorId,
  ownerId: actorId,
  name: 'Business',
  type: 'sole_trader',
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
});
const usecase = makeArchiveAccountingEntityUsecase({
  appContext: mockAppContext,
  accountingEntityRepo: mockAccountingEntityRepo,
  userPreferencesRepo: mockUserPreferencesRepo,
  repoService: mockRepoService,
  eventBus: mockEventBus,
});
const options = { correlationId: 'remove', tx: mockRepoTransaction.context };
describe('archiveAccountingEntityUsecase', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      actor: { id: actorId },
      user: { id: actorId },
      accountingEntity: current,
      correlationId: 'remove',
      idempotencyKey: 'archive-once',
    } as ReturnType<typeof mockAppContext.get>);
    mockRepoService.createTransaction.mockResolvedValue(mockRepoTransaction);
    mockRepoTransaction.handleError.mockImplementation(async (error) => {
      throw error;
    });
    mockAccountingEntityRepo.findById.mockResolvedValue(current);
  });

  it('requires context and locks fresh state, saves archival and selection cleanup, then publishes', async () => {
    await usecase();
    expect(mockAccountingEntityRepo.findById).toHaveBeenCalledWith(current.id, {
      ...options,
      lock: 'update',
    });
    expect(mockAppContext.get).toHaveBeenCalledWith([
      'user',
      'actor',
      'accountingEntity',
    ]);
    expect(mockAccountingEntityRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: current.id, status: 'archived' }),
      {
        ...options,
        history: expect.objectContaining({
          actorId,
          action: 'archived',
          correlationId: 'remove',
        }),
      }
    );
    expect(mockUserPreferencesRepo.clearAccountingEntity).toHaveBeenCalledWith(
      current.id,
      options
    );
    expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'domain:accounting:entity:archived',
        correlationId: 'remove',
        idempotencyKey: 'archive-once',
      }),
    ]);
    expect(mockRepoTransaction.commit.mock.invocationCallOrder[0]).toBeLessThan(
      mockEventBus.publish.mock.invocationCallOrder[0]
    );
    expect(mockAppContext.set).toHaveBeenCalledWith({
      accountingEntity: undefined,
    });
  });

  it('does not write or publish for an already archived entity', async () => {
    const [archived] = accountingEntityEntity.archive(current);
    mockAccountingEntityRepo.findById.mockResolvedValue(archived);
    await usecase();
    expect(mockAccountingEntityRepo.update).not.toHaveBeenCalled();
    expect(
      mockUserPreferencesRepo.clearAccountingEntity
    ).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
  });

  it('propagates a missing required context before opening a transaction', async () => {
    const failure = new runtimeError.ContextNotFound();
    mockAppContext.get.mockImplementation(() => {
      throw failure;
    });
    await expect(usecase()).rejects.toBe(failure);
    expect(mockAppContext.get).toHaveBeenCalledWith([
      'user',
      'actor',
      'accountingEntity',
    ]);
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
  });

  it('rejects an entity deleted after request enrichment', async () => {
    mockAccountingEntityRepo.findById.mockResolvedValue(null);
    await expect(usecase()).rejects.toBeInstanceOf(
      accountingAppError.ActiveEntityNotFound
    );
    expect(mockAccountingEntityRepo.update).not.toHaveBeenCalled();
    expect(mockRepoTransaction.handleError).toHaveBeenCalledTimes(1);
  });

  it.each(['lookup', 'archive', 'preferences'] as const)(
    'rolls back a %s failure without publishing',
    async (stage) => {
      const failure = new Error(stage);
      const operations = {
        lookup: mockAccountingEntityRepo.findById,
        archive: mockAccountingEntityRepo.update,
        preferences: mockUserPreferencesRepo.clearAccountingEntity,
      };
      operations[stage].mockRejectedValueOnce(failure);
      await expect(usecase()).rejects.toBe(failure);
      expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
      expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
      expect(mockAppContext.set).not.toHaveBeenCalled();
    }
  );
});
