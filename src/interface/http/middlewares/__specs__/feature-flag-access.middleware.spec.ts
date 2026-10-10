import { NextFunction, Request, Response } from 'express';

import { TEntityId } from '@shared/types/uuid';

import { IUser } from '@domain/user/types/user.types';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag.service.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import featureFlagError from '@app/context/errors/feature-flag.error';

import makeFeatureFlagAccessMiddleware from '@interface/http/middlewares/feature-flag-access.middleware';

describe('makeFeatureFlagAccessMiddleware', () => {
  const email = 'user@example.com';
  const user = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    email,
  } as IUser;

  let request: Partial<Request>;
  let response: Partial<Response>;
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAppContext.get.mockReturnValue({
      correlationId: 'correlation-id',
      idempotencyKey: 'idempotency-key',
      user,
    } as IAppContextData & { user: IUser });
    request = {};
    response = {};
    next = jest.fn();
  });

  function makeMiddleware() {
    return makeFeatureFlagAccessMiddleware({
      featureFlagAppService: mockFeatureFlagAppService,
      appContext: mockAppContext,
    }).canAccessAlpha1;
  }

  it('continues when the authenticated user can access Alpha 1', async () => {
    mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(true);

    await makeMiddleware()(request as Request, response as Response, next);

    expect(mockAppContext.get).toHaveBeenCalledWith(['user']);
    expect(mockFeatureFlagAppService.canAccessAlpha1).toHaveBeenCalledWith({
      email,
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects denied Alpha 1 access without continuing', async () => {
    mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(false);

    await expect(
      makeMiddleware()(request as Request, response as Response, next)
    ).rejects.toThrow(featureFlagError.NotPermitted);

    expect(next).not.toHaveBeenCalled();
  });
});
