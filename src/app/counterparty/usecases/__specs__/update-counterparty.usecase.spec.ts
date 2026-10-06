import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';
import repoError from '@shared/values/errors/repo.error';

import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import makeCounterpartyService from '@domain/counterparty/services/counterparty.service';
import actorEntity from '@domain/user/entities/actor.entity';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import { mockCounterpartyService } from '@app/counterparty/contracts/__mocks__/counterparty.domain.services.mock';
import { mockCounterpartyRepo } from '@app/counterparty/contracts/__mocks__/counterparty.repos.mock';
import makeUpdateCounterpartyUsecase from '@app/counterparty/usecases/update-counterparty.usecase';
import { mockJournalLineRepo } from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';

const service = makeCounterpartyService({
  journalLineRepo: mockJournalLineRepo,
});
const [actor] = actorEntity.makeUser({
  email: 'update@example.test',
  displayName: 'Updater',
});
const [before] = service.create({
  createdBy: generateUUID(),
  accountingEntityId: generateUUID(),
  name: 'Draft',
  type: 'individual',
  status: 'draft',
});
const usecase = makeUpdateCounterpartyUsecase({
  repoService: mockRepoService,
  appContext: mockAppContext,
  counterpartyService: mockCounterpartyService,
  counterpartyRepo: mockCounterpartyRepo,
  eventBus: mockEventBus,
});

describe('update counterparty use case', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockRepoService.createTransaction.mockResolvedValue(mockRepoTransaction);
    mockRepoTransaction.handleError.mockImplementation(async (error) => {
      throw error;
    });
    mockJournalLineRepo.findAllByCounterpartyId.mockResolvedValue([]);
    mockAppContext.get.mockReturnValue({
      actor,
      accountingEntity: { id: before.accountingEntityId },
      correlationId: 'update',
      idempotencyKey: 'request-key',
    } as IAppContextData);
    mockCounterpartyRepo.findById.mockResolvedValue(before);
    mockCounterpartyService.update.mockImplementation(service.update);
  });

  it('prepares from a tenant-scoped read and saves versioned history before publishing', async () => {
    let persisted = false;
    mockCounterpartyRepo.update.mockImplementation(async () => {
      persisted = true;
    });
    mockEventBus.publish.mockImplementation(async () => {
      expect(persisted).toBe(true);
      expect(mockRepoTransaction.commit).toHaveBeenCalledWith();
    });
    const response = await usecase(before.id, {
      name: 'Completed',
      status: 'active',
    });
    expect(mockRepoTransaction.handleError).not.toHaveBeenCalled();
    expect(mockRepoTransaction.dispose).toHaveBeenCalledTimes(1);
    expect(mockCounterpartyRepo.findById).toHaveBeenCalledWith(
      before.id,
      before.accountingEntityId,
      {
        correlationId: 'update',
        tx: mockRepoTransaction.context,
      }
    );
    expect(mockCounterpartyService.update).toHaveBeenCalledWith(
      before,
      {
        name: 'Completed',
        status: 'active',
        type: undefined,
        meta: undefined,
      },
      { correlationId: 'update', tx: mockRepoTransaction.context }
    );
    const [saved, options] = mockCounterpartyRepo.update.mock.calls[0];
    expect(options).toMatchObject({
      expectedVersion: before.version,
      correlationId: 'update',
      history: {
        entityVersion: before.version + 1,
        actorId: actor.id,
        action: 'activated',
        correlationId: 'update',
        diff: {
          before: { status: 'draft' },
          after: { status: 'active', name: 'Completed' },
        },
      },
    });
    expect(options.tx).toBe(mockRepoTransaction.context);
    expect(saved.createdBy).toBe(before.createdBy);
    expect(response).toMatchObject({
      id: before.id,
      name: 'Completed',
      status: 'active',
    });
    expect(mockEventBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'domain:counterparty:activated',
        correlationId: 'update',
        idempotencyKey: 'request-key',
      }),
    ]);
    expect(
      mockCounterpartyRepo.update.mock.invocationCallOrder[0]
    ).toBeGreaterThan(
      mockCounterpartyService.update.mock.invocationCallOrder[0]
    );
  });

  it('maps missing or foreign-tenant records to not found without mutation', async () => {
    mockCounterpartyRepo.findById.mockResolvedValue(null);
    await expect(usecase(before.id, { status: 'active' })).rejects.toThrow(
      appError.ResourceNotFound
    );
    expect(mockCounterpartyService.update).not.toHaveBeenCalled();
    expect(mockCounterpartyRepo.update).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('uses the version read by the server for optimistic persistence', async () => {
    const current = {
      ...before,
      version: before.version + 1,
    };
    mockCounterpartyRepo.findById.mockResolvedValue(current);

    await usecase(before.id, { name: 'Current' });

    expect(mockCounterpartyRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ version: current.version + 1 }),
      expect.objectContaining({ expectedVersion: current.version })
    );
  });

  it('locks and re-reads before checking an actual type change', async () => {
    mockCounterpartyRepo.findById.mockResolvedValue(before);

    await usecase(before.id, { type: 'organization' });

    expect(mockCounterpartyRepo.findById).toHaveBeenCalledTimes(2);
    expect(mockCounterpartyRepo.findById).toHaveBeenNthCalledWith(
      2,
      before.id,
      before.accountingEntityId,
      {
        correlationId: 'update',
        tx: mockRepoTransaction.context,
        lock: 'update',
      }
    );
  });

  it('rejects a foreign record even if the read adapter returns it', async () => {
    mockCounterpartyRepo.findById.mockResolvedValue({
      ...before,
      accountingEntityId: generateUUID(),
    });
    await expect(usecase(before.id, { name: 'Foreign' })).rejects.toThrow(
      appError.ResourceNotFound
    );
    expect(mockCounterpartyService.update).not.toHaveBeenCalled();
    expect(mockCounterpartyRepo.update).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { status: 'draft' },
    { roles: [] },
    { name: '' },
    { meta: { employer: {} } },
  ])(
    'rejects invalid DTO %j before reading the counterparty',
    async (payload) => {
      await expect(usecase(before.id, payload as never)).rejects.toThrow(
        appError.UnprocessableEntity
      );
      expect(mockCounterpartyRepo.findById).not.toHaveBeenCalled();
    }
  );

  it('rejects malformed IDs before context or repository access', async () => {
    await expect(usecase('invalid', { status: 'active' })).rejects.toThrow(
      counterpartyError.InvalidCounterpartyId
    );
    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockCounterpartyRepo.findById).not.toHaveBeenCalled();
  });

  it.each([
    'acquire',
    'read',
    'domain',
    'history',
    'write',
    'commit',
    'publish',
  ] as const)(
    'preserves the %s failure while disposing the transaction',
    async (stage) => {
      const failure = new Error(stage);
      if (stage === 'acquire')
        mockRepoService.createTransaction.mockRejectedValue(failure);
      if (stage === 'read')
        mockCounterpartyRepo.findById.mockRejectedValue(failure);
      if (stage === 'domain')
        mockCounterpartyService.update.mockRejectedValue(failure);
      if (stage === 'history')
        mockAppContext.get.mockReturnValue({
          ...mockAppContext.get(),
          actor: { ...actor, id: 'invalid' },
        } as never);
      if (stage === 'write')
        mockCounterpartyRepo.update.mockRejectedValue(failure);
      if (stage === 'commit')
        mockRepoTransaction.commit.mockRejectedValue(failure);
      if (stage === 'publish') mockEventBus.publish.mockRejectedValue(failure);

      const result = usecase(before.id, { status: 'active' });
      if (stage === 'history') await expect(result).rejects.toThrow();
      else await expect(result).rejects.toBe(failure);

      if (stage === 'publish')
        expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
      else expect(mockEventBus.publish).not.toHaveBeenCalled();
      if (stage === 'acquire')
        expect(mockRepoTransaction.handleError).not.toHaveBeenCalled();
      else {
        expect(mockRepoTransaction.handleError).toHaveBeenCalledTimes(1);
        expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(
          stage === 'history' ? expect.any(Error) : failure
        );
      }
      if (!['commit', 'publish'].includes(stage))
        expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
      if (['read', 'domain', 'history'].includes(stage))
        expect(mockCounterpartyRepo.update).not.toHaveBeenCalled();
    }
  );

  it('propagates both operation and cleanup errors from the transaction handler', async () => {
    const operationError = new Error('write failed');
    const cleanupError = new Error('rollback failed');
    const failure = new repoError.TransactionCleanupFailed({
      operationError,
      cleanupError,
    });
    mockCounterpartyRepo.update.mockRejectedValue(operationError);
    mockRepoTransaction.handleError.mockRejectedValue(failure);

    await expect(usecase(before.id, { name: 'Changed' })).rejects.toBe(failure);
    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(
      operationError
    );
    expect(failure.cause).toEqual({ operationError, cleanupError });
    expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('does not publish when disposing commit rejects', async () => {
    const failure = new Error('release failed');
    mockRepoTransaction.commit.mockRejectedValue(failure);
    await expect(usecase(before.id, { name: 'Changed' })).rejects.toBe(failure);
    expect(mockRepoTransaction.commit).toHaveBeenCalledWith();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
  });

  it.each(['commit', 'handleError'] as const)(
    'waits for %s before settling the request',
    async (stage) => {
      let release!: () => void;
      let started!: () => void;
      const blocked = new Promise<void>((resolve) => {
        release = resolve;
      });
      const ready = new Promise<void>((resolve) => {
        started = resolve;
      });
      const failure = new Error('write failed');
      if (stage === 'commit') {
        mockRepoTransaction.commit.mockImplementation(async () => {
          started();
          await blocked;
        });
      } else {
        mockCounterpartyRepo.update.mockRejectedValue(failure);
        mockRepoTransaction.handleError.mockImplementation(async (error) => {
          started();
          await blocked;
          throw error;
        });
      }
      let settled = false;
      const result = usecase(before.id, {
        name: 'Changed',
      }).then(
        (response) => {
          settled = true;
          return response;
        },
        (error: unknown) => {
          settled = true;
          return error;
        }
      );
      try {
        await ready;
        expect(settled).toBe(false);
        expect(mockEventBus.publish).not.toHaveBeenCalled();
      } finally {
        release();
        await result;
      }
      expect(settled).toBe(true);
      if (stage === 'commit')
        expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
      else {
        expect(await result).toBe(failure);
        expect(mockEventBus.publish).not.toHaveBeenCalled();
      }
    }
  );
});
