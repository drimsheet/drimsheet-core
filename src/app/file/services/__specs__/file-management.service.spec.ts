import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import mockFileStorageClient from '@app/file/contracts/__mocks__/file-storage-client.mock';
import fileAppError from '@app/file/errors/file.error';
import makeFileManagementAppService from '@app/file/services/file-management.service';
import { EFileUploadPurpose } from '@app/file/types/file.types';

jest.mock('@shared/utils/uuid-generator', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('FileManagementAppService', () => {
  const reference = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const secondReference = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
  const userId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const purpose = EFileUploadPurpose.JournalEntryAttachment;
  const mockedGenerateUUID = jest.mocked(generateUUID);

  const getService = () =>
    makeFileManagementAppService({ fileStorageClient: mockFileStorageClient });

  const storedPng = {
    fileUrl: 'https://example.com/file',
    contentType: 'image/png',
    size: 1024,
    metadata: Object.freeze({
      'original-name': Buffer.from('  Réçeipt (FINAL).png  ').toString(
        'base64url'
      ),
    }),
    data: Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
    ]),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGenerateUUID.mockReturnValue(reference);
    mockFileStorageClient.preSignUpload.mockResolvedValue({
      uploadUrl: 'https://example.com/file?signature=secret',
      fileUrl: 'https://example.com/file',
      headers: Object.freeze({ 'Content-Type': 'image/png' }),
    });
    mockFileStorageClient.readFile.mockResolvedValue(storedPng);
    mockFileStorageClient.deleteFile.mockResolvedValue();
  });

  it('pre-signs an upload with bound original-name metadata', async () => {
    const result = await getService().preSignUploads({
      userId,
      files: [
        {
          name: '  Réçeipt (FINAL).png  ',
          type: ' image/png ',
          size: 1024,
          purpose,
        },
      ],
    });

    expect(mockFileStorageClient.preSignUpload).toHaveBeenNthCalledWith(1, {
      key: `${userId}/${purpose}/${reference}`,
      contentType: 'image/png',
      metadata: {
        'original-name': Buffer.from('  Réçeipt (FINAL).png  ').toString(
          'base64url'
        ),
      },
    });
    expect(result).toEqual([
      {
        uploadUrl: 'https://example.com/file?signature=secret',
        reference,
        headers: { 'Content-Type': 'image/png' },
        file: {
          url: 'https://example.com/file',
          name: '  Réçeipt (FINAL).png  ',
          type: 'image/png',
          size: 1024,
        },
      },
    ]);
    expect(Object.isFrozen(result[0])).toBe(true);
    expect(Object.isFrozen(result[0].file)).toBe(true);
  });

  it.each([
    ['image/svg+xml', 1024, fileAppError.InvalidUploadType],
    ['image/png', 2 * 1024 * 1024 + 1, fileAppError.InvalidUploadSize],
  ])(
    'rejects invalid upload metadata before signing',
    async (type, size, ErrorClass) => {
      await expect(
        getService().preSignUploads({
          userId,
          files: [{ name: 'receipt.png', type, size, purpose }],
        })
      ).rejects.toThrow(ErrorClass);
      expect(mockFileStorageClient.preSignUpload).not.toHaveBeenCalled();
    }
  );

  it('rejects excessive uploads before generating references or signing', async () => {
    await expect(
      getService().preSignUploads({
        userId,
        files: [
          { name: 'receipt.png', type: 'image/png', size: 1024, purpose },
          { name: 'invoice.pdf', type: 'application/pdf', size: 2048, purpose },
        ],
      })
    ).rejects.toThrow(fileAppError.InvalidUploadCount);
    expect(mockedGenerateUUID).not.toHaveBeenCalled();
    expect(mockFileStorageClient.preSignUpload).not.toHaveBeenCalled();
  });

  it('maps unexpected upload preparation failures', async () => {
    mockFileStorageClient.preSignUpload.mockRejectedValue(
      new Error('provider detail')
    );

    await expect(
      getService().preSignUploads({
        userId,
        files: [
          {
            name: 'receipt.png',
            type: 'image/png',
            size: 1024,
            purpose,
          },
        ],
      })
    ).rejects.toThrow(fileAppError.UploadUnexpected);
  });

  it('preserves a stable upload preparation error', async () => {
    const error = new fileAppError.UploadUnexpected();
    mockFileStorageClient.preSignUpload.mockRejectedValue(error);

    await expect(
      getService().preSignUploads({
        userId,
        files: [
          {
            name: 'receipt.png',
            type: 'image/png',
            size: 1024,
            purpose,
          },
        ],
      })
    ).rejects.toBe(error);
  });

  it('returns an empty pre-signing result without storage calls', async () => {
    const result = await getService().preSignUploads({ userId, files: [] });

    expect(result).toEqual([]);
    expect(mockFileStorageClient.preSignUpload).not.toHaveBeenCalled();
  });

  it('claims an uploaded file using canonical storage data', async () => {
    const result = await getService().claimUploads({
      userId,
      purpose,
      references: [reference],
    });

    expect(mockFileStorageClient.readFile).toHaveBeenNthCalledWith(1, {
      key: `${userId}/${purpose}/${reference}`,
      range: { start: 0, end: 11 },
    });
    expect(result).toEqual([
      {
        url: storedPng.fileUrl,
        name: '  Réçeipt (FINAL).png  ',
        type: 'image/png',
        size: 1024,
      },
    ]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result[0])).toBe(true);
  });

  it('rejects excessive claim references before reading storage', async () => {
    await expect(
      getService().claimUploads({
        userId,
        purpose,
        references: [reference, secondReference],
      })
    ).rejects.toThrow(fileAppError.InvalidUploadCount);
    expect(mockFileStorageClient.readFile).not.toHaveBeenCalled();
  });

  it('returns an immutable empty collection without storage calls', async () => {
    const result = await getService().claimUploads({
      userId,
      purpose,
      references: [],
    });

    expect(result).toEqual([]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(mockFileStorageClient.readFile).not.toHaveBeenCalled();
  });

  it.each([
    [
      'invalid stored MIME type',
      { ...storedPng, contentType: 'image/svg+xml' },
      fileAppError.InvalidUploadType,
    ],
    [
      'oversized stored file',
      { ...storedPng, size: 2 * 1024 * 1024 + 1 },
      fileAppError.InvalidUploadSize,
    ],
    [
      'malformed original-name metadata',
      { ...storedPng, metadata: Object.freeze({ 'original-name': '%' }) },
      fileAppError.InvalidUploadReference,
    ],
  ])(
    'deletes a stored object with %s',
    async (_case, storedFile, ErrorClass) => {
      mockFileStorageClient.readFile.mockResolvedValue(storedFile);

      await expect(
        getService().claimUploads({
          userId,
          purpose,
          references: [reference],
        })
      ).rejects.toThrow(ErrorClass);
      expect(mockFileStorageClient.deleteFile).toHaveBeenCalledWith(
        `${userId}/${purpose}/${reference}`
      );
    }
  );

  it('does not delete an object that does not exist', async () => {
    mockFileStorageClient.readFile.mockResolvedValue(null);

    await expect(
      getService().claimUploads({
        userId,
        purpose,
        references: [reference],
      })
    ).rejects.toThrow(fileAppError.InvalidUploadReference);
    expect(mockFileStorageClient.deleteFile).not.toHaveBeenCalled();
  });

  it('rejects malformed references before constructing a storage key', async () => {
    await expect(
      getService().claimUploads({
        userId,
        purpose,
        references: ['not-a-uuid'],
      })
    ).rejects.toThrow(fileAppError.InvalidUploadReference);
    expect(mockFileStorageClient.readFile).not.toHaveBeenCalled();
  });

  it('maps storage read failures without deleting the object', async () => {
    mockFileStorageClient.readFile.mockRejectedValue(
      new Error('provider detail')
    );

    await expect(
      getService().claimUploads({
        userId,
        purpose,
        references: [reference],
      })
    ).rejects.toThrow(fileAppError.ClaimUnexpected);
    expect(mockFileStorageClient.deleteFile).not.toHaveBeenCalled();
  });

  it('maps stable storage read errors to the claim error', async () => {
    mockFileStorageClient.readFile.mockRejectedValue(
      new fileAppError.ReadUnexpected()
    );

    await expect(
      getService().claimUploads({
        userId,
        purpose,
        references: [reference],
      })
    ).rejects.toThrow(fileAppError.ClaimUnexpected);
  });

  it('maps malformed provider URLs to the stable claim error', async () => {
    mockFileStorageClient.readFile.mockResolvedValue({
      ...storedPng,
      fileUrl: 'not-a-url',
    });

    await expect(
      getService().claimUploads({
        userId,
        purpose,
        references: [reference],
      })
    ).rejects.toThrow(fileAppError.ClaimUnexpected);
    expect(mockFileStorageClient.deleteFile).not.toHaveBeenCalled();
  });

  it('deletes an object whose decoded original name is empty', async () => {
    mockFileStorageClient.readFile.mockResolvedValue({
      ...storedPng,
      metadata: Object.freeze({ 'original-name': 'IA' }),
    });

    await expect(
      getService().claimUploads({
        userId,
        purpose,
        references: [reference],
      })
    ).rejects.toThrow(fileAppError.InvalidUploadReference);
    expect(mockFileStorageClient.deleteFile).toHaveBeenCalled();
  });

  it('rejects the claim with a deletion error when cleanup fails', async () => {
    mockFileStorageClient.readFile.mockResolvedValue({
      ...storedPng,
      contentType: 'image/svg+xml',
    });
    mockFileStorageClient.deleteFile.mockRejectedValue(
      new Error('provider detail')
    );

    await expect(
      getService().claimUploads({
        userId,
        purpose,
        references: [reference],
      })
    ).rejects.toThrow(fileAppError.DeleteUnexpected);
  });

  it('preserves a stable deletion error from the provider', async () => {
    const error = new fileAppError.DeleteUnexpected();
    mockFileStorageClient.readFile.mockResolvedValue({
      ...storedPng,
      contentType: 'image/svg+xml',
    });
    mockFileStorageClient.deleteFile.mockRejectedValue(error);

    await expect(
      getService().claimUploads({
        userId,
        purpose,
        references: [reference],
      })
    ).rejects.toBe(error);
  });
});
