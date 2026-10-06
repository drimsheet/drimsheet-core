import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';
import repoError from '@shared/values/errors/repo.error';

import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import actorEntity from '@domain/user/entities/actor.entity';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import { mockCounterpartyRepo } from '@app/counterparty/contracts/__mocks__/counterparty.repos.mock';
import counterpartyDtoMapper from '@app/counterparty/dtos/counterparty/counterparty.dto.mapper';
import makeArchiveCounterpartyUsecase from '@app/counterparty/usecases/archive-counterparty.usecase';

const [actor] = actorEntity.makeUser({
  email: 'archive@example.test',
  displayName: 'Archiver',
});
const [before] = counterpartyEntity.make({
  createdBy: generateUUID(),
  accountingEntityId: generateUUID(),
  name: 'Supplier',
  type: 'organization',
  status: 'draft',
});
const usecase = makeArchiveCounterpartyUsecase({
  appContext: mockAppContext,
  counterpartyRepo: mockCounterpartyRepo,
  eventBus: mockEventBus,
});

describe('archive counterparty use case', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      actor,
      accountingEntity: { id: before.accountingEntityId },
      correlationId: 'archive',
      idempotencyKey: 'request-key',
    } as IAppContextData);
    mockCounterpartyRepo.findById.mockResolvedValue(before);
    mockCounterpartyRepo.update.mockResolvedValue();
    mockEventBus.publish.mockResolvedValue();
  });

  it('saves an archive and attributed history before publishing and mapping the DTO', async () => {
    const response = await usecase(before.id);

    expect(mockAppContext.get).toHaveBeenCalledWith([
      'actor',
      'accountingEntity',
    ]);
    expect(mockCounterpartyRepo.findById).toHaveBeenCalledWith(
      before.id,
      before.accountingEntityId,
      { correlationId: 'archive' }
    );
    expect(mockCounterpartyRepo.update).toHaveBeenCalledTimes(1);
    const [saved, options] = mockCounterpartyRepo.update.mock.calls[0];
    expect(response).toEqual(counterpartyDtoMapper.toDto(saved));
    expect(saved).toMatchObject({
      id: before.id,
      createdBy: before.createdBy,
      status: 'archived',
      version: before.version + 1,
    });
    expect(options).toEqual({
      correlationId: 'archive',
      expectedVersion: before.version,
      history: expect.objectContaining({
        entityId: before.id,
        entityVersion: saved.version,
        action: 'archived',
        actorId: actor.id,
        correlationId: 'archive',
        diff: expect.objectContaining({
          before: expect.objectContaining({ status: 'draft' }),
          after: expect.objectContaining({ status: 'archived' }),
        }),
      }),
    });
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'domain:counterparty:archived',
        data: saved,
        correlationId: 'archive',
        idempotencyKey: 'request-key',
      }),
    ]);
    expect(
      mockCounterpartyRepo.update.mock.invocationCallOrder[0]
    ).toBeLessThan(mockEventBus.publish.mock.invocationCallOrder[0]);
  });

  it.each([
    null,
    { ...before, accountingEntityId: generateUUID(), version: 99 },
    {
      ...before,
      accountingEntityId: generateUUID(),
      status: 'archived' as const,
      version: 99,
    },
  ])(
    'hides a missing or foreign counterparty before checking its version',
    async (stored) => {
      mockCounterpartyRepo.findById.mockResolvedValue(stored);
      await expect(usecase(before.id)).rejects.toThrow(
        appError.ResourceNotFound
      );
      expect(mockCounterpartyRepo.update).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );

  it('returns an already archived counterparty unchanged', async () => {
    const [archived] = counterpartyEntity.archive(before);
    mockCounterpartyRepo.findById.mockResolvedValue(archived);
    await expect(usecase(before.id)).resolves.toEqual(
      counterpartyDtoMapper.toDto(archived)
    );
    expect(mockCounterpartyRepo.update).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('rejects malformed IDs before reading context', async () => {
    await expect(usecase('invalid')).rejects.toThrow(
      counterpartyError.InvalidCounterpartyId
    );
    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockCounterpartyRepo.findById).not.toHaveBeenCalled();
  });

  it('rejects an invalid archived entity before returning its DTO', async () => {
    const [archived] = counterpartyEntity.archive(before);
    mockCounterpartyRepo.findById.mockResolvedValue({
      ...archived,
      name: '',
    });
    await expect(usecase(before.id)).rejects.toThrow(
      counterpartyError.InvalidName
    );
    expect(mockCounterpartyRepo.update).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('propagates a concurrent repository version conflict without publishing', async () => {
    const failure = new repoError.VersionNotFound();
    mockCounterpartyRepo.update.mockRejectedValue(failure);
    await expect(usecase(before.id)).rejects.toBe(failure);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it.each(['read', 'write', 'publish'] as const)(
    'propagates a %s failure',
    async (stage) => {
      const failure = new Error(stage);
      if (stage === 'read')
        mockCounterpartyRepo.findById.mockRejectedValue(failure);
      if (stage === 'write')
        mockCounterpartyRepo.update.mockRejectedValue(failure);
      if (stage === 'publish') mockEventBus.publish.mockRejectedValue(failure);
      await expect(usecase(before.id)).rejects.toBe(failure);
      if (stage === 'read')
        expect(mockCounterpartyRepo.update).not.toHaveBeenCalled();
      if (stage === 'publish')
        expect(mockCounterpartyRepo.update).toHaveBeenCalledTimes(1);
      else expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );
});
