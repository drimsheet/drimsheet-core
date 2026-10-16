import { Express } from 'express';
import request from 'supertest';

import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import repoError from '@shared/values/errors/repo.error';

import actorEntity from '@domain/user/entities/actor.entity';
import userEntity from '@domain/user/entities/user.entity';

import authError from '@app/auth/errors/auth.error';
import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag.service.mock';
import { mockActorService } from '@app/user/contracts/__mocks__/actor.services.mock';
import { mockUserRepo } from '@app/user/contracts/__mocks__/user.repos.mock';

import { tokenAppService } from '@infra/ioc/services/auth';
import { createApplication } from '@infra/server';

jest.mock('@infra/ioc/services/user', () => ({
  ...jest.requireActual('@infra/ioc/services/user'),
  actorService: jest.requireActual(
    '@app/user/contracts/__mocks__/actor.services.mock'
  ).mockActorService,
}));
jest.mock(
  '@infra/integrations/launchdarkly/launchdarkly-feature-flag.service',
  () => ({
    __esModule: true,
    default: jest.requireActual(
      '@app/context/contracts/__mocks__/feature-flag.service.mock'
    ).default,
  })
);
jest.mock('@infra/ioc/services/auth', () => ({
  tokenAppService: jest.requireActual(
    '@app/auth/contracts/__mocks__/token-service.mock'
  ).default,
}));
jest.mock('@infra/persistence/repos/user', () => ({
  __esModule: true,
  default: {
    user: jest.requireActual('@app/user/contracts/__mocks__/user.repos.mock')
      .mockUserRepo,
  },
}));
jest.mock('@infra/messaging', () => ({
  __esModule: true,
  default: {
    ...jest.requireActual('@infra/messaging').default,
    eventBus: jest.requireActual('@shared/contracts/__mocks__/event-bus.mock')
      .default,
  },
}));

const ENDPOINT = '/api/v1/users/profile';
const [actor] = actorEntity.makeUser({
  email: 'user@example.com',
  displayName: 'First Last',
});
const [user] = userEntity.make({
  createdBy: actor.id,
  actorId: actor.id,
  email: actor.username,
  emailVerified: true,
  firstName: 'First',
  lastName: 'Last',
});

describe('PATCH /users/profile', () => {
  let app: Express;
  const getAuthUser = tokenAppService.getAuthUser as jest.Mock;

  beforeEach(() => {
    jest.resetAllMocks();
    getAuthUser.mockResolvedValue({ id: user.id });
    mockActorService.resolveUser.mockResolvedValue(actor);
    mockUserRepo.findById.mockResolvedValue(user);
    mockUserRepo.update.mockResolvedValue(undefined);
    mockEventBus.publish.mockResolvedValue(undefined);
    app = createApplication();
  });

  afterEach(() => {
    expect(mockFeatureFlagAppService.canAccessAlpha1).not.toHaveBeenCalled();
  });

  describe('200 Response', () => {
    it.each([
      { firstName: ' Updated ' },
      { lastName: ' Updated ' },
      { firstName: 'Updated', lastName: 'Updated' },
    ])(
      'updates only the supplied names and returns the public profile',
      async (payload) => {
        const response = await request(app)
          .patch(`${ENDPOINT}?userId=someone-else`)
          .set('Authorization', 'Bearer valid-token')
          .set('x-user-id', 'someone-else')
          .send(payload);
        expect(response.status).toBe(200);
        expect(mockUserRepo.findById).toHaveBeenCalledTimes(1);
        expect(response.body).toEqual({
          id: user.id,
          email: user.email,
          emailVerified: true,
          firstName: payload.firstName?.trim() ?? user.firstName,
          lastName: payload.lastName?.trim() ?? user.lastName,
          createdAt: user.createdAt.toISOString(),
          updatedAt: expect.any(String),
        });
        expect(mockUserRepo.update).toHaveBeenCalledWith(
          expect.objectContaining({
            id: user.id,
            email: user.email,
            emailVerified: true,
          }),
          expect.objectContaining({ expectedVersion: user.version })
        );
      }
    );

    it.each([{}, { firstName: ' First ', lastName: 'Last' }])(
      'returns unchanged profiles without persistence or events',
      async (payload) => {
        const response = await request(app)
          .patch(ENDPOINT)
          .set('Authorization', 'Bearer valid-token')
          .send(payload);
        expect(response.status).toBe(200);
        expect(response.body.updatedAt).toBe(user.updatedAt.toISOString());
        expect(mockUserRepo.findById).toHaveBeenCalledTimes(1);
        expect(mockUserRepo.update).not.toHaveBeenCalled();
        expect(mockEventBus.publish).not.toHaveBeenCalled();
      }
    );
  });

  describe('401 Response', () => {
    it('requires authentication', async () => {
      const response = await request(app)
        .patch(ENDPOINT)
        .send({ firstName: 'Updated' });
      expect(response.status).toBe(401);
      expect(mockUserRepo.update).not.toHaveBeenCalled();
    });

    it('rejects expired tokens', async () => {
      getAuthUser.mockRejectedValue(new authError.ExpiredToken());
      const response = await request(app)
        .patch(ENDPOINT)
        .set('Authorization', 'Bearer expired')
        .send({ firstName: 'Updated' });
      expect(response.status).toBe(401);
      expect(mockUserRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('422 Response', () => {
    it.each([
      { firstName: '' },
      { lastName: ' ' },
      { firstName: null },
      { lastName: null },
      { firstName: 123 },
      { lastName: false },
      { firstName: 'x'.repeat(101) },
      { lastName: 'x'.repeat(101) },
      { firstName: 'Updated', email: 'attacker@example.com' },
      { emailVerified: true },
      { userId: 'other' },
      { id: 'other' },
      { version: 9 },
      { unknown: true },
    ])(
      'rejects invalid or unsupported fields before persistence',
      async (payload) => {
        const response = await request(app)
          .patch(ENDPOINT)
          .set('Authorization', 'Bearer valid-token')
          .send(payload);
        expect(response.status).toBe(422);
        expect(response.body).toMatchObject({
          name: 'UnprocessableEntity',
          errorKey: 'app_error_validation_error',
        });
        expect(mockUserRepo.update).not.toHaveBeenCalled();
        expect(mockEventBus.publish).not.toHaveBeenCalled();
      }
    );
  });

  describe('409 Response', () => {
    it('rejects concurrent changes without publishing', async () => {
      mockUserRepo.update.mockRejectedValue(new repoError.VersionNotFound());
      const response = await request(app)
        .patch(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .send({ firstName: 'Updated' });
      expect(response.status).toBe(409);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  describe('500 Response', () => {
    it('sanitizes persistence failures', async () => {
      mockUserRepo.update.mockRejectedValue(
        new Error('private database details')
      );
      const response = await request(app)
        .patch(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .send({ firstName: 'Updated' });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        name: 'InternalServerError',
        errorKey: 'app_error_unexpected',
      });
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });
});
