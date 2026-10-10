import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IUser } from '@domain/user/types/user.types';

import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag.service.mock';
import { IFileUploadDto } from '@app/file/dtos/file-upload/file-upload.dto';
import fileAppError from '@app/file/errors/file.error';
import { EFileUploadPurpose } from '@app/file/types/file.types';

import { tokenAppService } from '@infra/ioc/services/auth';
import * as fileUseCases from '@infra/ioc/usecases/file';
import userRepos from '@infra/persistence/repos/user';
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
    default: jest.requireActual<
      typeof import('@app/context/contracts/__mocks__/feature-flag.service.mock')
    >('@app/context/contracts/__mocks__/feature-flag.service.mock').default,
  })
);

jest.mock('../../../src/infra/ioc/services/auth', () => ({
  __esModule: true,
  tokenAppService: {
    getAuthUser: jest.fn(),
  },
}));

jest.mock('../../../src/infra/persistence/repos/user', () => ({
  __esModule: true,
  default: {
    user: {
      findById: jest.fn(),
    },
  },
}));

jest.mock('../../../src/infra/ioc/usecases/file', () => ({
  __esModule: true,
  preSignUploadsUseCase: jest.fn(),
}));

const ENDPOINT = '/api/v1/files/upload';
const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
const payload = [
  {
    name: 'receipt.png',
    type: 'image/png',
    size: 1024,
    purpose: EFileUploadPurpose.JournalEntryAttachment,
  },
];

const mockUser: IUser = {
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  id: userId,
  version: 1,
  email: 'user@example.com',
  emailVerified: true,
  firstName: 'First',
  lastName: 'Last',
  deletedAt: null,
  createdAt: new Date('2026-03-13T00:00:00.000Z'),
  updatedAt: new Date('2026-03-13T00:00:00.000Z'),
};

const uploads: IFileUploadDto[] = [
  {
    uploadUrl: 'https://example.com/receipt?signature=secret',
    reference: '123e4567-e89b-12d3-a456-426614174002',
    headers: {
      'Content-Type': 'image/png',
      'x-amz-meta-original-name': 'cmVjZWlwdC5wbmc',
    },
    file: {
      url: 'https://example.com/receipt',
      name: 'receipt.png',
      type: 'image/png',
      size: 1024,
    },
  },
];

describe('POST /files/upload', () => {
  let app: Express;
  const mockGetAuthUser = tokenAppService.getAuthUser as jest.Mock;
  const mockFindUser = userRepos.user.findById as jest.Mock;
  const mockPreSignUploads = fileUseCases.preSignUploadsUseCase as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthUser.mockResolvedValue({ id: userId });
    mockFindUser.mockResolvedValue(mockUser);
    mockPreSignUploads.mockResolvedValue(uploads);
    app = createApplication();
  });

  afterEach(() => {
    expect(mockFeatureFlagAppService.canAccessAlpha1).not.toHaveBeenCalled();
  });

  it('returns direct upload instructions for an authenticated request', async () => {
    const response = await request(app)
      .post(ENDPOINT)
      .set('Authorization', 'Bearer valid-token')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.type).toBe('application/json');
    expect(response.body).toEqual(uploads);
    expect(mockPreSignUploads).toHaveBeenCalledWith(payload);
  });

  it('rejects an unauthenticated request', async () => {
    const response = await request(app).post(ENDPOINT).send(payload);

    expect(response.status).toBe(401);
    expect(mockPreSignUploads).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON metadata before orchestration', async () => {
    const response = await request(app)
      .post(ENDPOINT)
      .set('Authorization', 'Bearer valid-token')
      .send({ name: 'receipt.png', size: 1024 });

    expect(response.status).toBe(422);
    expect(mockPreSignUploads).not.toHaveBeenCalled();
  });

  it('returns usecase validation failures as 422 responses', async () => {
    mockPreSignUploads.mockRejectedValue(
      new appError.UnprocessableEntity([
        { field: 'size', message: 'file_attachment_error_size_invalid' },
      ])
    );

    const response = await request(app)
      .post(ENDPOINT)
      .set('Authorization', 'Bearer valid-token')
      .send([{ ...payload[0], size: 0 }]);

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      name: 'UnprocessableEntity',
      errorKey: 'app_error_validation_error',
    });
  });

  it('returns the stable error when Blackblaze cannot create the instruction', async () => {
    mockPreSignUploads.mockRejectedValue(new fileAppError.UploadUnexpected());

    const response = await request(app)
      .post(ENDPOINT)
      .set('Authorization', 'Bearer valid-token')
      .send(payload);

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      name: 'InternalServerError',
      errorKey: 'app_error_unexpected',
    });
  });

  it('returns a client error when the purpose policy rejects metadata', async () => {
    mockPreSignUploads.mockRejectedValue(new fileAppError.InvalidUploadType());

    const response = await request(app)
      .post(ENDPOINT)
      .set('Authorization', 'Bearer valid-token')
      .send([{ ...payload[0], type: 'image/svg+xml' }]);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      name: 'FileAppError',
      errorKey: 'app_error_file_upload_type_invalid',
    });
  });

  it('does not accept multipart file uploads', async () => {
    const response = await request(app)
      .post(ENDPOINT)
      .set('Authorization', 'Bearer valid-token')
      .field('name', payload[0].name)
      .field('type', payload[0].type)
      .field('size', String(payload[0].size));

    expect(response.status).toBe(422);
    expect(mockPreSignUploads).not.toHaveBeenCalled();
  });
});
