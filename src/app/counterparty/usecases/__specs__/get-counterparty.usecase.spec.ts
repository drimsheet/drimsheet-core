import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import counterpartyError from '@domain/counterparty/errors/counterparty.error';
import { ICounterparty } from '@domain/counterparty/types/counterparty.types';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import { mockCounterpartyRepo } from '@app/counterparty/contracts/__mocks__/counterparty.repos.mock';
import makeGetCounterpartyUsecase from '@app/counterparty/usecases/get-counterparty.usecase';

describe('makeGetCounterpartyUsecase', () => {
  const counterpartyId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
  const accountingEntityId =
    '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const correlationId = 'test-correlation-id';

  const counterparty: ICounterparty = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: counterpartyId,
    accountingEntityId,
    name: 'Acme Corp',
    status: 'active',
    type: 'organization',
    meta: {
      vendor: { address: null },
      contractor: {
        address: {
          line1: 'Main Street',
          line2: null,
          city: 'Lagos',
          region: null,
          postalCode: null,
          countryCode: 'NG',
        },
      },
    },
    roles: ['vendor', 'contractor'],
    version: 1,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-02T00:00:00.000Z'),
  };

  const getUseCase = () =>
    makeGetCounterpartyUsecase({
      appContext: mockAppContext,
      counterpartyRepo: mockCounterpartyRepo,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAppContext.get.mockReturnValue({
      correlationId,
      accountingEntity: {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: accountingEntityId,
      },
    } as IAppContextData);
  });

  it('rejects an invalid ID before reading context or repository', async () => {
    await expect(getUseCase()('invalid-id')).rejects.toThrow(
      counterpartyError.InvalidCounterpartyId
    );

    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockCounterpartyRepo.findById).not.toHaveBeenCalled();
  });

  it('loads the counterparty within the active accounting entity and maps its DTO', async () => {
    mockCounterpartyRepo.findById.mockResolvedValue(counterparty);

    const counterpartyDto = await getUseCase()(counterpartyId);

    expect(mockAppContext.get).toHaveBeenCalledWith(['accountingEntity']);
    expect(mockCounterpartyRepo.findById).toHaveBeenCalledWith(
      counterpartyId,
      accountingEntityId,
      { correlationId }
    );
    expect(counterpartyDto).toEqual({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: counterpartyId,
      accountingEntityId,
      name: 'Acme Corp',
      status: 'active',
      type: 'organization',
      meta: {
        vendor: { address: null },
        contractor: {
          address: {
            line1: 'Main Street',
            line2: undefined,
            city: 'Lagos',
            region: undefined,
            postalCode: undefined,
            countryCode: 'NG',
          },
        },
      },
      roles: ['vendor', 'contractor'],
      version: 1,
      createdAt: counterparty.createdAt,
      updatedAt: counterparty.updatedAt,
    });
    expect(counterpartyDto.roles).not.toBe(counterparty.roles);
  });

  it('returns the same not-found error for an absent or out-of-scope ID', async () => {
    mockCounterpartyRepo.findById.mockResolvedValue(null);

    await expect(getUseCase()(counterpartyId)).rejects.toThrow(
      appError.ResourceNotFound
    );
    expect(mockCounterpartyRepo.findById).toHaveBeenCalledWith(
      counterpartyId,
      accountingEntityId,
      { correlationId }
    );
  });

  it('propagates repository failures', async () => {
    const repositoryError = new Error('repository unavailable');
    mockCounterpartyRepo.findById.mockRejectedValue(repositoryError);

    await expect(getUseCase()(counterpartyId)).rejects.toBe(repositoryError);
  });
});
