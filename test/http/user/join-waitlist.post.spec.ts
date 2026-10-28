import { Server } from 'node:http';

import request from 'supertest';

import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag-app.service.mock';
import { mockWaitListMemberRepo } from '@app/user/contracts/__mocks__/user.repos.mock';

import createApplication from '@interface/http/application';

import { closeTestServer, startTestServer } from '../../setup/http-listener';

jest.mock('@infra/ioc/services/user', () => ({
  ...jest.requireActual('@infra/ioc/services/user'),
  actorService: jest.requireActual(
    '@app/user/contracts/__mocks__/actor.services.mock'
  ).mockActorService,
}));
jest.mock('@infra/ioc/services/context', () => ({
  __esModule: true,
  featureFlagAppService: jest.requireActual<
    typeof import('@app/context/contracts/__mocks__/feature-flag-app.service.mock')
  >('@app/context/contracts/__mocks__/feature-flag-app.service.mock').default,
}));
jest.mock('@infra/messaging', () => ({
  __esModule: true,
  default: {
    ...jest.requireActual('@infra/messaging').default,
    eventBus: jest.requireActual('@shared/contracts/__mocks__/event-bus.mock')
      .default,
  },
}));

jest.mock('@infra/persistence/repos/user', () => ({
  __esModule: true,
  default: {
    ...jest.requireActual('@infra/persistence/repos/user').default,
    waitListMember: jest.requireActual(
      '@app/user/contracts/__mocks__/user.repos.mock'
    ).mockWaitListMemberRepo,
  },
}));

const ENDPOINT = '/api/v1/users/waitlist';
const payload = { email: 'member@example.com', feature: 'mvp' };

describe('POST /users/waitlist', () => {
  let server: Server;
  beforeEach(async () => {
    jest.resetAllMocks();
    mockWaitListMemberRepo.findByEmailAndFeature.mockResolvedValue(null);
    mockWaitListMemberRepo.create.mockResolvedValue(undefined);
    mockEventBus.publish.mockResolvedValue(undefined);
    server = await startTestServer(createApplication());
  });
  afterEach(async () => {
    await closeTestServer(server);
    expect(mockFeatureFlagAppService.canAccessAlpha1).not.toHaveBeenCalled();
  });
  describe('204 Response', () => {
    it('accepts a public submission without authentication', async () => {
      const response = await request(server).post(ENDPOINT).send(payload);
      expect(response.status).toBe(204);
      expect(response.text).toBe('');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
      expect(mockEventBus.publish).toHaveBeenCalledWith([
        expect.objectContaining({ type: 'domain:waitlist-member:created' }),
      ]);
      expect(mockWaitListMemberRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...payload,
          firstName: null,
          lastName: null,
        }),
        expect.objectContaining({ correlationId: expect.any(String) })
      );
    });
    it('returns success for repeat membership without another write', async () => {
      const response = await request(server)
        .post(ENDPOINT)
        .send({ ...payload, firstName: 'First', lastName: null });
      expect(response.status).toBe(204);
      const [member] = mockWaitListMemberRepo.create.mock.calls[0];
      mockWaitListMemberRepo.findByEmailAndFeature.mockResolvedValue(member);
      mockWaitListMemberRepo.create.mockClear();
      mockEventBus.publish.mockClear();
      const repeated = await request(server).post(ENDPOINT).send(payload);
      expect(repeated.status).toBe(204);
      expect(mockWaitListMemberRepo.create).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });
  describe('422 Response', () => {
    it.each([
      {},
      { ...payload, feature: 'other' },
      { ...payload, email: 'invalid' },
      { ...payload, firstName: 42 },
      { ...payload, lastName: '' },
      { ...payload, extra: true },
    ])('rejects invalid input %j before storage', async (body) => {
      const response = await request(server).post(ENDPOINT).send(body);
      expect(response.status).toBe(422);
      expect(response.body.errorKey).toBe('app_error_validation_error');
      expect(
        mockWaitListMemberRepo.findByEmailAndFeature
      ).not.toHaveBeenCalled();
      expect(mockWaitListMemberRepo.create).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });
  describe('500 Response', () => {
    it.each([
      new Error('private database details'),
      Object.assign(new Error('unique constraint violation'), {
        code: '23505',
      }),
    ])(
      'sanitizes failed inserts without publishing events: %j',
      async (failure) => {
        mockWaitListMemberRepo.create.mockRejectedValue(failure);
        const response = await request(server).post(ENDPOINT).send(payload);
        expect(response.status).toBe(500);
        expect(mockEventBus.publish).not.toHaveBeenCalled();
        expect(response.body).toEqual({
          name: 'InternalServerError',
          errorKey: 'app_error_unexpected',
        });
      }
    );
  });
});
