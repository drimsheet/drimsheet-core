import { TEntityId } from '@shared/types/uuid';

import { ICounterparty } from '@domain/counterparty/types/counterparty.types';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import { mockCounterpartyRepo } from '@app/counterparty/contracts/__mocks__/counterparty.repos.mock';
import { IGetCounterpartiesQuery } from '@app/counterparty/dtos/counterparty/counterparty.dto';
import makeGetCounterpartiesUsecase from '@app/counterparty/usecases/get-counterparties.usecase';

describe('makeGetCounterpartiesUsecase', () => {
  const getUseCase = () =>
    makeGetCounterpartiesUsecase({
      appContext: mockAppContext,
      counterpartyRepo: mockCounterpartyRepo,
    });

  const correlationId = 'test-corr-id';
  const accountingEntity = {
    id: 'entity-123' as TEntityId,
    name: 'Test Business',
    functionalCurrencyCode: 'USD',
  };

  const mockCounterparty: ICounterparty = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: 'cp-1' as TEntityId,
    accountingEntityId: accountingEntity.id,
    name: 'Acme Corp',
    status: 'active',
    type: 'organization',
    meta: { vendor: { address: null } },
    roles: ['vendor'],
    version: 1,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  };

  const validQuery: IGetCounterpartiesQuery = {
    page: 1,
    limit: 10,
    orderBy: 'name',
    sortDirection: 'asc',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAppContext.get.mockReturnValue({
      correlationId,
      accountingEntity,
    } as IAppContextData);
  });

  it('throws ZodError for invalid query', async () => {
    const useCase = getUseCase();
    const invalidQuery = {
      page: 0,
    } as IGetCounterpartiesQuery;

    await expect(useCase(invalidQuery)).rejects.toThrow();
  });

  it('returns empty list when repository returns no counterparties', async () => {
    mockCounterpartyRepo.findAll.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });

    const useCase = getUseCase();
    const result = await useCase(validQuery);

    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(0);
    expect(mockCounterpartyRepo.findAll).toHaveBeenCalledWith(
      accountingEntity.id,
      expect.objectContaining({
        offset: 0,
        limit: 10,
        correlationId,
      })
    );
  });

  it('queries counterparties and maps to DTOs', async () => {
    mockCounterpartyRepo.findAll.mockResolvedValue({
      data: [mockCounterparty],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });

    const useCase = getUseCase();
    const result = await useCase(validQuery);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'cp-1',
      accountingEntityId: 'entity-123',
      name: 'Acme Corp',
      status: 'active',
      type: 'organization',
      meta: { vendor: { address: null } },
      roles: ['vendor'],
      createdAt: mockCounterparty.createdAt,
      updatedAt: mockCounterparty.updatedAt,
    });
    expect(result.data[0]).not.toHaveProperty('version');
    expect(result.meta.total).toBe(1);
  });

  it('propagates repository error', async () => {
    const repoError = new Error('repo failed');
    mockCounterpartyRepo.findAll.mockRejectedValue(repoError);

    const useCase = getUseCase();
    await expect(useCase(validQuery)).rejects.toThrow(repoError);
  });
});
