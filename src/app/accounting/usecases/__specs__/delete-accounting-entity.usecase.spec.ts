import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import { TEntityId } from '@shared/types/uuid';
import runtimeError from '@shared/values/errors/runtime.error';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';

import { mockAccountingEntityService } from '@app/accounting/contracts/__mocks__/accounting.domain.services.mock';
import {
  mockAccountingContextRepo,
  mockAccountingEntityRepo,
  mockReportingContextRepo,
} from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import accountingAppError from '@app/accounting/errors/accounting.error';
import makeDeleteAccountingEntityUsecase from '@app/accounting/usecases/delete-accounting-entity.usecase';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { mockCounterpartyRepo } from '@app/counterparty/contracts/__mocks__/counterparty.repos.mock';
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
const usecase = makeDeleteAccountingEntityUsecase({
  appContext: mockAppContext,
  accountingEntityRepo: mockAccountingEntityRepo,
  accountingContextRepo: mockAccountingContextRepo,
  reportingContextRepo: mockReportingContextRepo,
  counterpartyRepo: mockCounterpartyRepo,
  userPreferencesRepo: mockUserPreferencesRepo,
  accountingEntityService: mockAccountingEntityService,
  repoService: mockRepoService,
  eventBus: mockEventBus,
});
const options = { correlationId: 'remove', tx: mockRepoTransaction.context };
const deletionWrites = [
  mockReportingContextRepo.deleteByAccountingEntityId,
  mockAccountingContextRepo.deleteByAccountingEntityId,
  mockCounterpartyRepo.deleteByAccountingEntityId,
  mockUserPreferencesRepo.clearAccountingEntity,
  mockAccountingEntityRepo.delete,
];

describe('deleteAccountingEntityUsecase', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      actor: { id: actorId },
      user: { id: actorId },
      accountingEntity: current,
      correlationId: 'remove',
      idempotencyKey: 'delete-once',
    } as ReturnType<typeof mockAppContext.get>);
    mockRepoService.createTransaction.mockResolvedValue(mockRepoTransaction);
    mockRepoTransaction.handleError.mockImplementation(async (error) => {
      throw error;
    });
    mockAccountingEntityRepo.findById.mockResolvedValue(current);
    mockAccountingEntityService.delete.mockResolvedValue(
      accountingEntityEntity.delete(current)
    );
  });

  it('requires context and locks fresh state, then deletes setup and entity in one transaction', async () => {
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
    expect(mockAccountingEntityService.delete).toHaveBeenCalledWith(
      current,
      options
    );
    for (const write of deletionWrites) {
      expect(write).toHaveBeenCalledWith(current.id, options);
    }
    const calls = [...deletionWrites, mockRepoTransaction.commit].map(
      (fn) => fn.mock.invocationCallOrder[0]
    );
    expect(calls).toEqual([...calls].sort((a, b) => a - b));
    expect(mockAccountingEntityRepo.update).not.toHaveBeenCalled();
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'domain:accounting:entity:deleted',
        data: current,
        correlationId: 'remove',
        idempotencyKey: 'delete-once',
      })
    );
    expect(mockRepoTransaction.commit.mock.invocationCallOrder[0]).toBeLessThan(
      mockEventBus.publish.mock.invocationCallOrder[0]
    );

    expect(mockAccountingEntityService.validateAccess).not.toHaveBeenCalled();
    expect(mockAppContext.set).toHaveBeenCalledWith({
      accountingEntity: undefined,
    });
  });

  it('rejects journal references without deleting or silently archiving', async () => {
    const failure = new accountingEntityError.DeletionWithJournalEntries();
    mockAccountingEntityService.delete.mockRejectedValue(failure);
    await expect(usecase()).rejects.toBe(failure);
    for (const write of deletionWrites) {
      expect(write).not.toHaveBeenCalled();
    }
    expect(mockAccountingEntityRepo.update).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
    expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
    expect(mockAppContext.set).not.toHaveBeenCalled();
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
    expect(mockAccountingEntityService.delete).not.toHaveBeenCalled();
    expect(mockRepoTransaction.handleError).toHaveBeenCalledTimes(1);
  });

  it.each([
    'lookup',
    'eligibility',
    'reporting',
    'accounting',
    'counterparty',
    'preferences',
    'delete',
    'commit',
  ] as const)(
    'rolls back a %s failure without publishing or clearing request state',
    async (stage) => {
      const failure = new Error(stage);
      const operations = {
        lookup: mockAccountingEntityRepo.findById,
        eligibility: mockAccountingEntityService.delete,
        reporting: mockReportingContextRepo.deleteByAccountingEntityId,
        accounting: mockAccountingContextRepo.deleteByAccountingEntityId,
        counterparty: mockCounterpartyRepo.deleteByAccountingEntityId,
        preferences: mockUserPreferencesRepo.clearAccountingEntity,
        delete: mockAccountingEntityRepo.delete,
        commit: mockRepoTransaction.commit,
      };
      operations[stage].mockRejectedValueOnce(failure);
      await expect(usecase()).rejects.toBe(failure);
      expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
      if (stage !== 'commit') {
        expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
      }
      expect(mockEventBus.publish).not.toHaveBeenCalled();
      expect(mockAppContext.set).not.toHaveBeenCalled();
    }
  );
});
