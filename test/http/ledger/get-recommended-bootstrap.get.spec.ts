import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';

import actorEntity from '@domain/user/entities/actor.entity';
import { IUser } from '@domain/user/types/user.types';

import mockTokenService from '@app/auth/contracts/__mocks__/token-service.mock';
import mockFeatureFlagService from '@app/context/contracts/__mocks__/feature-flag.service.mock';
import { IRecommendedBootstrapDto } from '@app/ledger/dtos/recommended-bootstrap/recommended-bootstrap.dto';
import makeGetRecommendedBootstrapUsecase from '@app/ledger/usecases/get-recommended-bootstrap.usecase';
import { mockActorService } from '@app/user/contracts/__mocks__/actor.services.mock';
import { mockUserRepo } from '@app/user/contracts/__mocks__/user.repos.mock';

import { getRecommendedBootstrapUseCase } from '@infra/ioc/usecases/ledger';
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
  tokenService: jest.requireActual(
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
jest.mock('@infra/ioc/usecases/ledger', () => ({
  getRecommendedBootstrapUseCase: jest.fn(),
}));

const ENDPOINT = '/api/v1/ledger/recommended-bootstrap';
const userId = '123e4567-e89b-42d3-a456-426614174001' as TEntityId;
const actor = actorEntity.makeUser({
  email: 'recommendations@example.com',
  displayName: 'Account Owner',
})[0];

describe('GET /ledger/recommended-bootstrap', () => {
  let app: Express;
  const mockGetRecommendations = jest.mocked(getRecommendedBootstrapUseCase);

  beforeEach(() => {
    jest.resetAllMocks();
    mockTokenService.getAuthUser.mockResolvedValue({ id: userId });
    mockUserRepo.findById.mockResolvedValue({
      id: userId,
      actorId: actor.id,
      email: 'recommendations@example.com',
    } as IUser);
    mockActorService.resolveUser.mockResolvedValue(actor);
    mockFeatureFlagService.canAccessAlpha1.mockResolvedValue(true);
    mockGetRecommendations.mockImplementation(
      makeGetRecommendedBootstrapUsecase()
    );
    app = createApplication();
  });

  describe('200 Response', () => {
    it('returns the complete grouped catalog without selecting an accounting entity', async () => {
      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
      const body = response.body as IRecommendedBootstrapDto;
      expect(Object.keys(body)).toEqual([
        'receivables',
        'payables',
        'revenue',
        'expense',
        'suspense',
      ]);
      expect(Object.values(body).map((group) => group.length)).toEqual([
        1, 1, 6, 8, 2,
      ]);
      expect(body.receivables[0]).toMatchObject({
        isControlAccount: false,
        controlAccountCode: '102002',
      });
      expect(body.payables[0]).toMatchObject({
        isControlAccount: false,
        controlAccountCode: '201002',
      });
      expect(body).toStrictEqual(makeGetRecommendedBootstrapUsecase()());
      for (const group of Object.values(body)) {
        for (const account of group) {
          expect(account).not.toHaveProperty('sub');
          expect(account).not.toHaveProperty('controlAccountKey');
        }
      }
      expect(mockGetRecommendations).toHaveBeenCalledWith();
      expect(mockFeatureFlagService.canAccessAlpha1).toHaveBeenCalledWith({
        email: 'recommendations@example.com',
      });
    });
  });

  describe('401 Response', () => {
    it('rejects requests without authentication', async () => {
      const response = await request(app).get(ENDPOINT);
      expect(response.status).toBe(401);
      expect(mockGetRecommendations).not.toHaveBeenCalled();
      expect(mockFeatureFlagService.canAccessAlpha1).not.toHaveBeenCalled();
    });

    it('rejects a token that does not resolve an authenticated user', async () => {
      mockUserRepo.findById.mockResolvedValue(null);
      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer invalid-token');
      expect(response.status).toBe(401);
      expect(mockGetRecommendations).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('requires Alpha 1 access before reading recommendations', async () => {
      mockFeatureFlagService.canAccessAlpha1.mockResolvedValue(false);
      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token');
      expect(response.status).toBe(403);
      expect(mockGetRecommendations).not.toHaveBeenCalled();
    });
  });

  describe('500 Response', () => {
    it('sanitizes unexpected read failures', async () => {
      mockGetRecommendations.mockImplementationOnce(() => {
        throw new Error('private catalog details');
      });
      const response = await request(app)
        .get(ENDPOINT)
        .set('Authorization', 'Bearer valid-token');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        name: 'InternalServerError',
        errorKey: 'app_error_unexpected',
      });
    });
  });
});
