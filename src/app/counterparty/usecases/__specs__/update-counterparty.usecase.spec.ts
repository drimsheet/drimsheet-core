import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';

import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import makeCounterpartyService from '@domain/counterparty/services/counterparty.service';
import actorEntity from '@domain/user/entities/actor.entity';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import { mockCounterpartyService } from '@app/counterparty/contracts/__mocks__/counterparty.domain.services.mock';
import { mockCounterpartyRepo } from '@app/counterparty/contracts/__mocks__/counterparty.repos.mock';
import makeUpdateCounterpartyUsecase from '@app/counterparty/usecases/update-counterparty.usecase';

const service = makeCounterpartyService();
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
  appContext: mockAppContext,
  counterpartyService: mockCounterpartyService,
  counterpartyRepo: mockCounterpartyRepo,
  eventBus: mockEventBus,
});

describe('update counterparty use case', () => {
  beforeEach(() => {
    jest.resetAllMocks();
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
    });
    const response = await usecase(before.id, {
      expectedVersion: before.version,
      name: 'Completed',
      status: 'active',
    });
    expect(mockCounterpartyRepo.findById).toHaveBeenCalledWith(
      before.id,
      before.accountingEntityId,
      { correlationId: 'update' }
    );
    expect(mockCounterpartyService.update).toHaveBeenCalledWith(before, {
      name: 'Completed',
      status: 'active',
      type: undefined,
      meta: undefined,
    });
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
    expect(saved.createdBy).toBe(before.createdBy);
    expect(response).toMatchObject({
      id: before.id,
      name: 'Completed',
      status: 'active',
      version: before.version + 1,
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
    await expect(
      usecase(before.id, { status: 'active', expectedVersion: before.version })
    ).rejects.toThrow(appError.ResourceNotFound);
    expect(mockCounterpartyService.update).not.toHaveBeenCalled();
    expect(mockCounterpartyRepo.update).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('rejects a stale client version before domain preparation', async () => {
    mockCounterpartyRepo.findById.mockResolvedValue({
      ...before,
      version: before.version + 1,
    });
    await expect(
      usecase(before.id, { expectedVersion: before.version, name: 'Stale' })
    ).rejects.toThrow(appError.Conflict);
    expect(mockCounterpartyService.update).not.toHaveBeenCalled();
    expect(mockCounterpartyRepo.update).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('rejects a foreign record even if the read adapter returns it', async () => {
    mockCounterpartyRepo.findById.mockResolvedValue({
      ...before,
      accountingEntityId: generateUUID(),
    });
    await expect(
      usecase(before.id, { expectedVersion: before.version, name: 'Foreign' })
    ).rejects.toThrow(appError.ResourceNotFound);
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
      await expect(
        usecase(before.id, {
          expectedVersion: before.version,
          ...payload,
        } as never)
      ).rejects.toThrow(appError.UnprocessableEntity);
      expect(mockCounterpartyRepo.findById).not.toHaveBeenCalled();
    }
  );

  it('rejects malformed IDs before context or repository access', async () => {
    await expect(
      usecase('invalid', { status: 'active', expectedVersion: before.version })
    ).rejects.toThrow(counterpartyError.InvalidCounterpartyId);
    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockCounterpartyRepo.findById).not.toHaveBeenCalled();
  });

  it.each(['read', 'domain', 'history', 'write'] as const)(
    'does not publish when %s fails',
    async (stage) => {
      const failure = new Error(stage);
      if (stage === 'read')
        mockCounterpartyRepo.findById.mockRejectedValue(failure);
      if (stage === 'domain')
        mockCounterpartyService.update.mockImplementation(() => {
          throw failure;
        });
      if (stage === 'history')
        mockAppContext.get.mockReturnValue({
          ...mockAppContext.get(),
          actor: { ...actor, id: 'invalid' },
        } as never);
      if (stage === 'write')
        mockCounterpartyRepo.update.mockRejectedValue(failure);
      await expect(
        usecase(before.id, {
          status: 'active',
          expectedVersion: before.version,
        })
      ).rejects.toThrow();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
      if (['read', 'domain', 'history'].includes(stage))
        expect(mockCounterpartyRepo.update).not.toHaveBeenCalled();
    }
  );
});
