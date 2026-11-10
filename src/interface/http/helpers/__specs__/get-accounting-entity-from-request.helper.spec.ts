import { Request } from 'express';

import { IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';

import { mockAccountingEntityRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';

import getAccountingEntityFromRequestHelper from '@interface/http/helpers/get-accounting-entity-from-request.helper';

describe('getAccountingEntityFromRequestHelper', () => {
  const accountingEntityId =
    '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
  const userId = 'user-id' as TEntityId;
  const repoOptions: IReadRepoOptions = {
    correlationId: 'request-correlation-id',
  };

  let mockReq: Partial<Request>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = { headers: {} };
  });

  it('returns null if the user ID is not provided', async () => {
    const accountingEntity = await getAccountingEntityFromRequestHelper(
      mockReq as Request,
      mockAccountingEntityRepo,
      repoOptions
    );

    expect(accountingEntity).toBeNull();
    expect(mockAccountingEntityRepo.findByIdAndUserId).not.toHaveBeenCalled();
  });

  it('returns null if the accounting entity header is missing', async () => {
    const accountingEntity = await getAccountingEntityFromRequestHelper(
      mockReq as Request,
      mockAccountingEntityRepo,
      repoOptions,
      userId
    );

    expect(accountingEntity).toBeNull();
    expect(mockAccountingEntityRepo.findByIdAndUserId).not.toHaveBeenCalled();
  });

  it('rejects a malformed accounting entity ID', async () => {
    mockReq.headers = { 'x-accounting-entity-id': 'invalid-uuid' };

    await expect(
      getAccountingEntityFromRequestHelper(
        mockReq as Request,
        mockAccountingEntityRepo,
        repoOptions,
        userId
      )
    ).rejects.toThrow(appError.BadRequest);
  });

  it('returns null if the accounting entity is not found', async () => {
    mockReq.headers = { 'x-accounting-entity-id': accountingEntityId };
    mockAccountingEntityRepo.findByIdAndUserId.mockResolvedValue(null);

    const accountingEntity = await getAccountingEntityFromRequestHelper(
      mockReq as Request,
      mockAccountingEntityRepo,
      repoOptions,
      userId
    );

    expect(mockAccountingEntityRepo.findByIdAndUserId).toHaveBeenCalledWith(
      accountingEntityId,
      userId,
      repoOptions
    );
    expect(accountingEntity).toBeNull();
  });

  it('returns the accounting entity from the repository', async () => {
    const expectedAccountingEntity = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: accountingEntityId,
      ownerId: userId,
    } as IAccountingEntity;
    mockReq.headers = { 'x-accounting-entity-id': accountingEntityId };
    mockAccountingEntityRepo.findByIdAndUserId.mockResolvedValue(
      expectedAccountingEntity
    );

    const accountingEntity = await getAccountingEntityFromRequestHelper(
      mockReq as Request,
      mockAccountingEntityRepo,
      repoOptions,
      userId
    );

    expect(accountingEntity).toBe(expectedAccountingEntity);
  });
});
