import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import { TEntityId } from '@shared/types/uuid';
import runtimeError from '@shared/values/errors/runtime.error';

import makeCounterpartyService from '@domain/counterparty/services/counterparty.service';
import actorEntity from '@domain/user/entities/actor.entity';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import { mockCounterpartyService } from '@app/counterparty/contracts/__mocks__/counterparty.domain.services.mock';
import { mockCounterpartyRepo } from '@app/counterparty/contracts/__mocks__/counterparty.repos.mock';
import { ICounterpartyCreateReq } from '@app/counterparty/dtos/counterparty/counterparty.dto';
import makeCreateCounterpartyUsecase from '@app/counterparty/usecases/create-counterparty.usecase';
import { mockJournalLineRepo } from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';

const mockCounterpartyDomainServices = Object.freeze({
  counterparty: mockCounterpartyService,
});

const actor = {
  ...actorEntity.makeUser({
    email: 'actor@example.com',
    displayName: 'Actor',
  })[0],
  id: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
};

describe('makeCreateCounterpartyUsecase', () => {
  const accountingEntityId = '123e4567-e89b-12d3-a456-426614174001';

  const realCounterpartyService = makeCounterpartyService({
    journalLineRepo: mockJournalLineRepo,
  });

  let usecase: ReturnType<typeof makeCreateCounterpartyUsecase>;

  const validPayload: ICounterpartyCreateReq = {
    name: 'Jane Doe',
    status: 'active',
    type: 'individual',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      actor,
      correlationId: 'test-correlation-id',
      idempotencyKey: 'test-idempotency-key',
      accountingEntity: {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: accountingEntityId as TEntityId,
      },
    } as IAppContextData);
    mockCounterpartyDomainServices.counterparty.create.mockImplementation(
      (payload) => realCounterpartyService.create(payload)
    );
    usecase = makeCreateCounterpartyUsecase({
      appContext: mockAppContext,
      counterpartyService: mockCounterpartyDomainServices.counterparty,
      counterpartyRepo: mockCounterpartyRepo,
      eventBus: mockEventBus,
    });
  });

  it('should successfully create, persist, enrich/publish events, and return a mapped DTO', async () => {
    const result = await usecase(validPayload);

    expect(mockAppContext.get).toHaveBeenCalledWith([
      'actor',
      'accountingEntity',
    ]);

    expect(
      mockCounterpartyDomainServices.counterparty.create
    ).toHaveBeenCalledWith({
      accountingEntityId,
      name: 'Jane Doe',
      type: 'individual',
      status: 'active',
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    });

    expect(mockCounterpartyRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        accountingEntityId,
        name: 'Jane Doe',
        type: 'individual',
        status: 'active',
        meta: {},
        roles: [],
      }),
      expect.objectContaining({
        correlationId: 'test-correlation-id',
        history: expect.objectContaining({
          actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
          correlationId: 'test-correlation-id',
        }),
      })
    );

    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'domain:counterparty:created',
          correlationId: 'test-correlation-id',
          idempotencyKey: 'test-idempotency-key',
        }),
      ])
    );

    expect(result).toEqual({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: expect.any(String),
      accountingEntityId: '123e4567-e89b-12d3-a456-426614174001',
      name: 'Jane Doe',
      status: 'active',
      type: 'individual',
      meta: {},
      roles: [],
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    expect(result).not.toHaveProperty('version');
  });

  it.each([
    actorEntity.makeSystem(actor.id)[0],
    actorEntity.makeAgent({ createdBy: actor.id })[0],
  ])('attributes creation to a $type actor without a user', async (caller) => {
    mockAppContext.get.mockReturnValue({
      ...mockAppContext.get(),
      actor: caller,
    });

    const result = await usecase(validPayload);

    expect(result.createdBy).toBe(caller.id);
    expect(mockCounterpartyRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: caller.id }),
      expect.objectContaining({
        history: expect.objectContaining({ actorId: caller.id }),
      })
    );
  });

  it('stops before creation or effects when the actor context is missing', async () => {
    mockAppContext.get.mockImplementationOnce(() => {
      throw new runtimeError.ContextNotFound();
    });

    await expect(usecase(validPayload)).rejects.toThrow(
      runtimeError.ContextNotFound
    );

    expect(mockAppContext.get).toHaveBeenCalledWith([
      'actor',
      'accountingEntity',
    ]);
    expect(mockCounterpartyService.create).not.toHaveBeenCalled();
    expect(mockCounterpartyRepo.create).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('should stop and throw if validation fails', async () => {
    const invalidPayload = {
      ...validPayload,
      name: '', // empty name fails validation
    };

    await expect(usecase(invalidPayload)).rejects.toThrow();

    expect(
      mockCounterpartyDomainServices.counterparty.create
    ).not.toHaveBeenCalled();
    expect(mockCounterpartyRepo.create).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('should stop before persistence and event publication if domain service creation fails', async () => {
    mockCounterpartyDomainServices.counterparty.create.mockImplementationOnce(
      () => {
        throw new Error('domain error');
      }
    );

    await expect(usecase(validPayload)).rejects.toThrow('domain error');

    expect(mockCounterpartyRepo.create).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('should stop before event publication if persistence fails', async () => {
    mockCounterpartyRepo.create.mockRejectedValueOnce(
      new Error('database error')
    );

    await expect(usecase(validPayload)).rejects.toThrow('database error');

    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
  it('persists one final multi-role counterparty and audit before publishing every transition', async () => {
    const address = {
      line1: ' Main Street ',
      city: ' Lagos ',
      countryCode: 'ng',
    };
    const payload = {
      ...validPayload,
      meta: { employer: { address }, vendor: {}, contractor: { address } },
    };
    const result = await usecase(payload);

    expect(mockCounterpartyService.create).toHaveBeenCalledTimes(1);
    expect(mockCounterpartyService.create).toHaveBeenCalledWith(
      expect.objectContaining({ accountingEntityId, meta: payload.meta })
    );
    expect(mockCounterpartyRepo.create).toHaveBeenCalledTimes(1);
    const [saved, options] = mockCounterpartyRepo.create.mock.calls[0];
    expect(saved.roles).toEqual(['employer', 'vendor', 'contractor']);
    expect(options.history.diff).toEqual({
      before: null,
      after: JSON.parse(JSON.stringify(saved)),
    });
    expect(saved.meta.employer?.displayName).toBeNull();
    expect(saved.meta.employer?.address.countryCode).toBe('NG');
    expect(saved.meta.vendor?.address).toBeNull();
    expect(result.roles).toEqual(saved.roles);
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish.mock.calls[0][0]).toHaveLength(4);
    expect(
      mockCounterpartyRepo.create.mock.invocationCallOrder[0]
    ).toBeLessThan(mockEventBus.publish.mock.invocationCallOrder[0]);
  });

  it('propagates publication failure after successful persistence', async () => {
    mockEventBus.publish.mockRejectedValueOnce(new Error('publication failed'));
    await expect(usecase(validPayload)).rejects.toThrow('publication failed');
    expect(mockCounterpartyRepo.create).toHaveBeenCalledTimes(1);
  });

  it('rejects the entire request when one nested role is invalid', async () => {
    await expect(
      usecase({
        ...validPayload,
        meta: {
          vendor: {},
          contractor: {
            address: { line1: '', city: 'Lagos', countryCode: 'NG' },
          },
        },
      })
    ).rejects.toThrow();
    expect(mockCounterpartyService.create).not.toHaveBeenCalled();
    expect(mockCounterpartyRepo.create).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
});
