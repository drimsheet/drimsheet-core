import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import mockFileManagementAppService from '@app/file/contracts/__mocks__/file-management.service.mock';
import fileAppError from '@app/file/errors/file.error';
import { EFileUploadPurpose } from '@app/file/types/file.types';
import makePreSignUploadsUsecase from '@app/file/usecases/pre-sign-uploads.usecase';

describe('preSignUploadsUsecase', () => {
  const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const uploads = [
    Object.freeze({
      uploadUrl: 'https://example.com/receipt?signature=secret',
      reference: '123e4567-e89b-12d3-a456-426614174002',
      headers: Object.freeze({ 'Content-Type': 'image/png' }),
      file: Object.freeze({
        url: 'https://example.com/receipt',
        name: ' receipt.png ',
        type: 'image/png',
        size: 1024,
      }),
    }),
  ];

  const getUsecase = () =>
    makePreSignUploadsUsecase({
      appContext: mockAppContext,
      fileManagementAppService: mockFileManagementAppService,
    });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAppContext.get.mockReturnValue({
      user: {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: userId,
      },
    } as IAppContextData & Required<Pick<IAppContextData, 'user'>>);
    mockFileManagementAppService.preSignUploads.mockResolvedValue(uploads);
  });

  it('delegates the file batch with the authenticated user ID', async () => {
    const payload = [
      {
        name: ' receipt.png ',
        type: ' image/png ',
        size: 1024,
        purpose: EFileUploadPurpose.JournalEntryAttachment,
      },
    ];

    await expect(getUsecase()(payload)).resolves.toBe(uploads);
    expect(mockAppContext.get).toHaveBeenCalledWith(['user']);
    expect(mockFileManagementAppService.preSignUploads).toHaveBeenCalledWith({
      userId,
      files: payload,
    });
  });

  it.each([
    {
      name: '',
      type: 'image/png',
      size: 1024,
      purpose: EFileUploadPurpose.JournalEntryAttachment,
    },
    {
      name: 'receipt.png',
      type: '',
      size: 1024,
      purpose: EFileUploadPurpose.JournalEntryAttachment,
    },
    {
      name: 'receipt.png',
      type: 'image/png',
      size: 0,
      purpose: EFileUploadPurpose.JournalEntryAttachment,
    },
  ])(
    'rejects invalid metadata before resolving user context',
    async (payload) => {
      await expect(getUsecase()([payload])).rejects.toThrow(
        appError.UnprocessableEntity
      );
      expect(mockAppContext.get).not.toHaveBeenCalled();
      expect(
        mockFileManagementAppService.preSignUploads
      ).not.toHaveBeenCalled();
    }
  );

  it('rejects an empty file batch before resolving user context', async () => {
    await expect(getUsecase()([])).rejects.toThrow(
      appError.UnprocessableEntity
    );
    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockFileManagementAppService.preSignUploads).not.toHaveBeenCalled();
  });

  it('delegates purpose-specific count validation to file management', async () => {
    const file = {
      name: 'receipt.png',
      type: 'image/png',
      size: 1024,
      purpose: EFileUploadPurpose.JournalEntryAttachment,
    };
    const payload = [file, { ...file, name: 'invoice.png' }];
    const error = new fileAppError.InvalidUploadCount();
    mockFileManagementAppService.preSignUploads.mockRejectedValue(error);

    await expect(getUsecase()(payload)).rejects.toBe(error);
    expect(mockAppContext.get).toHaveBeenCalledWith(['user']);
    expect(mockFileManagementAppService.preSignUploads).toHaveBeenCalledWith({
      userId,
      files: payload,
    });
  });

  it('propagates file-management failures', async () => {
    const error = new fileAppError.UploadUnexpected();
    mockFileManagementAppService.preSignUploads.mockRejectedValue(error);

    await expect(
      getUsecase()([
        {
          name: 'receipt.png',
          type: 'image/png',
          size: 1024,
          purpose: EFileUploadPurpose.JournalEntryAttachment,
        },
      ])
    ).rejects.toBe(error);
  });
});
