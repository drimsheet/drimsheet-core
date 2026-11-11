import { Server } from 'node:http';

import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag-app.service.mock';
import fileAppError from '@app/file/errors/file.error';

import { tokenAppService } from '@infra/ioc/services/auth';
import { uploadJournalEntryFileUseCase } from '@infra/ioc/usecases/journal-entry';
import accountingRepos from '@infra/persistence/repos/accounting';
import userRepos from '@infra/persistence/repos/user';

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

jest.mock('@infra/ioc/services/auth', () => ({
  __esModule: true,
  tokenAppService: { getAuthUser: jest.fn() },
}));

jest.mock('@infra/ioc/usecases/journal-entry', () => ({
  __esModule: true,
  uploadJournalEntryFileUseCase: jest.fn(),
}));

jest.mock('@infra/persistence/repos/accounting', () => ({
  __esModule: true,
  default: {
    accountingEntity: { findByIdAndUserId: jest.fn() },
  },
}));

jest.mock('@infra/persistence/repos/user', () => ({
  __esModule: true,
  default: {
    user: { findById: jest.fn() },
  },
}));

const ENDPOINT = '/api/v1/journal-entries/upload';
const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const accountingEntityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;

const payload = {
  reference: '123e4567-e89b-12d3-a456-426614174004',
  accountId: '123e4567-e89b-12d3-a456-426614174003',
};

describe('POST /journal-entries/upload', () => {
  let server: Server;
  const mockUpload = jest.mocked(uploadJournalEntryFileUseCase);

  beforeEach(async () => {
    jest.resetAllMocks();
    mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(true);
    jest
      .mocked(tokenAppService.getAuthUser)
      .mockResolvedValue({ id: userId } as IUser);
    jest.mocked(userRepos.user.findById).mockResolvedValue({
      id: userId,
      actorId: 'a1111111-1111-4111-8111-111111111111',
    } as IUser);
    jest
      .mocked(accountingRepos.accountingEntity.findByIdAndUserId)
      .mockResolvedValue({
        id: accountingEntityId,
        ownerId: userId,
        functionalCurrencyCode: 'NGN',
      } as IAccountingEntity);
    mockUpload.mockResolvedValue(undefined);
    server = await startTestServer(createApplication());
  });

  afterEach(async () => {
    await closeTestServer(server);
  });

  const send = (body: object = payload) =>
    request(server)
      .post(ENDPOINT)
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntityId)
      .send(body);

  describe('204 Response', () => {
    it.each([undefined, 'payment', 'receipt'])(
      'accepts the DTO with sourceType %s',
      async (sourceType) => {
        const body = { ...payload, sourceType };
        const response = await send(body);
        expect(response.status).toBe(204);
        expect(response.text).toBe('');
        expect(mockUpload).toHaveBeenCalledWith(
          expect.objectContaining(payload)
        );
      }
    );
  });

  describe('400 Response', () => {
    it('returns file claim errors', async () => {
      mockUpload.mockRejectedValue(new fileAppError.InvalidUploadReference());
      const response = await send();
      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe(
        'app_error_file_upload_reference_invalid'
      );
    });
  });

  describe('401 Response', () => {
    it('requires authentication', async () => {
      const response = await request(server).post(ENDPOINT).send(payload);
      expect(response.status).toBe(401);
      expect(mockUpload).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('requires access to the accounting entity', async () => {
      jest
        .mocked(accountingRepos.accountingEntity.findByIdAndUserId)
        .mockResolvedValue({
          id: accountingEntityId,
          ownerId: '123e4567-e89b-12d3-a456-426614174999',
        } as IAccountingEntity);
      const response = await send();
      expect(response.status).toBe(403);
      expect(mockUpload).not.toHaveBeenCalled();
    });
  });

  describe('422 Response', () => {
    it.each([
      { accountId: payload.accountId },
      { ...payload, sourceType: 'invalid' },
      { ...payload, reference: 123 },
      { ...payload, reference: null },
    ])('rejects malformed DTOs', async (body) => {
      const response = await send(body);
      expect(response.status).toBe(422);
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it('returns usecase validation errors', async () => {
      mockUpload.mockRejectedValue(
        new appError.UnprocessableEntity([
          {
            field: 'reference',
            message: 'app_error_file_upload_reference_invalid',
          },
        ])
      );
      expect((await send()).status).toBe(422);
    });
  });
});
