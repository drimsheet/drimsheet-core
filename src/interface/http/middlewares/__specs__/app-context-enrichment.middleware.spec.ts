import { NextFunction, Request, Response } from 'express';

import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import actorEntity from '@domain/user/entities/actor.entity';
import actorError from '@domain/user/errors/actor.error';
import { IUser } from '@domain/user/types/user.types';

import { mockAccountingEntityRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import mockTokenAppService from '@app/auth/contracts/__mocks__/token-service.mock';
import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import { mockActorService } from '@app/user/contracts/__mocks__/actor.services.mock';
import { mockUserRepo } from '@app/user/contracts/__mocks__/user.repos.mock';

import makeAppContextEnrichmentMiddleware from '@interface/http/middlewares/app-context-enrichment.middleware';

describe('makeAppContextEnrichmentMiddleware', () => {
  const actor = {
    ...actorEntity.makeUser({
      email: 'user@example.com',
      displayName: 'User',
    })[0],
    id: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  };
  const correlationId = 'request-correlation-id';
  const userId = 'user-id' as TEntityId;
  const accountingEntityId =
    '123e4567-e89b-12d3-a456-426614174000' as TEntityId;

  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    jest.resetAllMocks();
    mockActorService.resolveUser.mockResolvedValue(actor);

    mockAppContext.get.mockReturnValue({
      correlationId,
      idempotencyKey: '',
    } as IAppContextData);

    mockReq = { headers: {} };
    mockRes = {};
    mockNext = jest.fn();
  });

  function makeMiddleware() {
    return makeAppContextEnrichmentMiddleware(
      mockAppContext,
      mockAccountingEntityRepo,
      mockTokenAppService,
      mockUserRepo,
      mockActorService
    );
  }

  it('keeps anonymous request context empty', async () => {
    const middleware = makeMiddleware();

    await middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockTokenAppService.getAuthUser).not.toHaveBeenCalled();
    expect(mockUserRepo.findById).not.toHaveBeenCalled();
    expect(mockAccountingEntityRepo.findByIdAndUserId).not.toHaveBeenCalled();
    expect(mockAppContext.set).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('enriches context with an authenticated user', async () => {
    const user = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: userId,
    } as IUser;
    mockReq.headers = { authorization: 'Bearer valid-token' };
    mockTokenAppService.getAuthUser.mockResolvedValue({ id: userId });
    mockUserRepo.findById.mockResolvedValue(user);

    const middleware = makeMiddleware();

    await middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockUserRepo.findById).toHaveBeenCalledWith(userId, {
      correlationId,
    });
    expect(mockAppContext.set).toHaveBeenCalledWith({
      user,
      actor,
    });
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('uses the same repo options for user and accounting entity hydration', async () => {
    const user = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: userId,
    } as IUser;
    const accountingEntity = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: accountingEntityId,
      ownerId: userId,
    } as IAccountingEntity;
    mockReq.headers = {
      authorization: 'Bearer valid-token',
      'x-accounting-entity-id': accountingEntityId,
    };
    mockTokenAppService.getAuthUser.mockResolvedValue({ id: userId });
    mockUserRepo.findById.mockResolvedValue(user);
    mockAccountingEntityRepo.findByIdAndUserId.mockResolvedValue(
      accountingEntity
    );

    const middleware = makeMiddleware();

    await middleware(mockReq as Request, mockRes as Response, mockNext);

    const userRepoOptions = mockUserRepo.findById.mock.calls[0][1];
    const accountingRepoOptions =
      mockAccountingEntityRepo.findByIdAndUserId.mock.calls[0][2];

    expect(accountingRepoOptions).toBe(userRepoOptions);
    expect(userRepoOptions).toEqual({ correlationId });
    expect(mockAppContext.set).toHaveBeenCalledWith({
      user,
      actor,
      accountingEntity,
    });
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('propagates authentication failures without enriching context', async () => {
    const error = new Error('authentication failed');
    mockReq.headers = { authorization: 'Bearer invalid-token' };
    mockTokenAppService.getAuthUser.mockRejectedValue(error);

    const middleware = makeMiddleware();

    await expect(
      middleware(mockReq as Request, mockRes as Response, mockNext)
    ).rejects.toThrow(error);
    expect(mockAppContext.set).not.toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('propagates malformed accounting entity IDs without enriching context', async () => {
    const user = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: userId,
    } as IUser;
    mockReq.headers = {
      authorization: 'Bearer valid-token',
      'x-accounting-entity-id': 'not-a-uuid',
    };
    mockTokenAppService.getAuthUser.mockResolvedValue({ id: userId });
    mockUserRepo.findById.mockResolvedValue(user);

    const middleware = makeMiddleware();

    await expect(
      middleware(mockReq as Request, mockRes as Response, mockNext)
    ).rejects.toThrow(appError.BadRequest);
    expect(mockAppContext.set).not.toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('propagates accounting repository failures without enriching context', async () => {
    const error = new Error('accounting lookup failed');
    const user = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: userId,
    } as IUser;
    mockReq.headers = {
      authorization: 'Bearer valid-token',
      'x-accounting-entity-id': accountingEntityId,
    };
    mockTokenAppService.getAuthUser.mockResolvedValue({ id: userId });
    mockUserRepo.findById.mockResolvedValue(user);
    mockAccountingEntityRepo.findByIdAndUserId.mockRejectedValue(error);

    const middleware = makeMiddleware();

    await expect(
      middleware(mockReq as Request, mockRes as Response, mockNext)
    ).rejects.toThrow(error);
    expect(mockAppContext.set).not.toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
  });
  it('uses the resolved identity and ignores client actor/delegation headers', async () => {
    const [actor] = actorEntity.makeUser({
      email: 'user@example.com',
      displayName: 'User',
    });
    const user = { id: userId, actorId: actor.id } as IUser;
    mockReq.headers = {
      authorization: 'Bearer valid-token',
      'x-actor-id': 'forged',
      'x-on-behalf-of': 'forged',
    };
    mockTokenAppService.getAuthUser.mockResolvedValue({ id: userId });
    mockUserRepo.findById.mockResolvedValue(user);
    mockActorService.resolveUser.mockResolvedValueOnce(actor);
    await makeMiddleware()(mockReq as Request, mockRes as Response, mockNext);
    expect(mockActorService.resolveUser).toHaveBeenCalledWith(user, {
      correlationId,
    });
    expect(mockAppContext.set).toHaveBeenCalledWith({ user, actor });
  });

  it.each([
    actorError.Disabled,
    actorError.NotFound,
    actorError.InvalidUserLink,
  ])(
    'does not populate context when actor resolution fails',
    async (ActorError) => {
      mockReq.headers = { authorization: 'Bearer valid-token' };
      mockTokenAppService.getAuthUser.mockResolvedValue({ id: userId });
      mockUserRepo.findById.mockResolvedValue({ id: userId } as IUser);
      mockActorService.resolveUser.mockRejectedValueOnce(new ActorError());
      await expect(
        makeMiddleware()(mockReq as Request, mockRes as Response, mockNext)
      ).rejects.toThrow(ActorError);
      expect(mockAppContext.set).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    }
  );
});
