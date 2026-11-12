import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import fileAppError from '@app/file/errors/file.error';

import makeBlackblazeClient from '@infra/integrations/blackblaze/blackblaze-client';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

describe('blackblazeClient', () => {
  const config = {
    appKeyId: 'application-key-id',
    appKey: 'application-key',
    bucketName: 'drimsheet-files',
    endpoint: 'https://s3.us-west-004.backblazeb2.com',
    region: 'us-west-004',
  };
  const uploadPayload = {
    key: 'files/id',
    contentType: 'image/png',
    metadata: Object.freeze({ 'original-name': 'cmVjZWlwdC5wbmc' }),
  };
  const presign = jest.mocked(getSignedUrl);
  const send = jest.spyOn(S3Client.prototype, 'send');

  beforeEach(() => {
    jest.clearAllMocks();
    presign.mockResolvedValue(
      'https://s3.us-west-004.backblazeb2.com/drimsheet-files/files/id?X-Amz-Signature=secret'
    );
    send.mockResolvedValue({} as never);
  });

  it('defers S3 client setup until a storage operation is requested', () => {
    expect(() => makeBlackblazeClient({ ...config, region: '' })).not.toThrow();
  });

  it('presigns one PutObject request with metadata-bound instructions', async () => {
    const client = makeBlackblazeClient(config);

    await expect(client.preSignUpload(uploadPayload)).resolves.toEqual({
      uploadUrl:
        'https://s3.us-west-004.backblazeb2.com/drimsheet-files/files/id?X-Amz-Signature=secret',
      fileUrl:
        'https://s3.us-west-004.backblazeb2.com/drimsheet-files/files/id',
      headers: {
        'Content-Type': 'image/png',
        'x-amz-meta-original-name': 'cmVjZWlwdC5wbmc',
      },
    });

    const [s3Client, command, options] = presign.mock.calls[0];
    expect(s3Client).toBeInstanceOf(S3Client);
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect((command as PutObjectCommand).input).toEqual({
      Bucket: 'drimsheet-files',
      Key: 'files/id',
      ContentType: 'image/png',
      Metadata: { 'original-name': 'cmVjZWlwdC5wbmc' },
    });
    expect(options).toEqual({
      expiresIn: 300,
      unhoistableHeaders: new Set(['x-amz-meta-original-name']),
    });
    await expect(s3Client.config.region()).resolves.toBe('us-west-004');
  });

  it('returns immutable upload instructions', async () => {
    const result =
      await makeBlackblazeClient(config).preSignUpload(uploadPayload);

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.headers)).toBe(true);
  });

  it('removes expiring URL data from the stable upload URL', async () => {
    presign.mockResolvedValue(
      'https://files.example.com/files/id?signature=secret#fragment'
    );

    await expect(
      makeBlackblazeClient(config).preSignUpload(uploadPayload)
    ).resolves.toMatchObject({ fileUrl: 'https://files.example.com/files/id' });
  });

  it('maps upload preparation failures without provider details', async () => {
    presign.mockRejectedValue(new Error('sensitive provider detail'));

    await expect(
      makeBlackblazeClient(config).preSignUpload(uploadPayload)
    ).rejects.toEqual(new fileAppError.UploadUnexpected());
  });

  it.each([
    'https://s3.us-west-004.backblazeb2.com/drimsheet-files/files/id',
    'https://drimsheet-files.s3.us-west-004.backblazeb2.com/files/id',
    'https://s3.us-west-004.backblazeb2.com/drimsheet-files/files/%69d?old=signature#fragment',
  ])('signs a five-minute download URL for %s', async (fileUrl) => {
    const client = makeBlackblazeClient(config);
    const downloadUrl =
      'https://s3.us-west-004.backblazeb2.com/drimsheet-files/files/id?X-Amz-Signature=download';
    presign.mockResolvedValue(downloadUrl);

    await expect(client.getDownloadUrl(fileUrl)).resolves.toBe(downloadUrl);

    const [s3Client, command, options] = presign.mock.calls[0];
    expect(s3Client).toBeInstanceOf(S3Client);
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect((command as GetObjectCommand).input).toEqual({
      Bucket: 'drimsheet-files',
      Key: 'files/id',
    });
    expect(options).toEqual({ expiresIn: 300 });
    expect(send).not.toHaveBeenCalled();
  });

  it('maps download signing failures without provider details', async () => {
    presign.mockRejectedValue(new Error('sensitive provider detail'));

    await expect(
      makeBlackblazeClient(config).getDownloadUrl(
        'https://s3.us-west-004.backblazeb2.com/drimsheet-files/files/id'
      )
    ).rejects.toEqual(new fileAppError.DownloadUnexpected());
  });

  it('maps malformed download URLs without calling the signer', async () => {
    await expect(
      makeBlackblazeClient(config).getDownloadUrl('not-a-url')
    ).rejects.toEqual(new fileAppError.DownloadUnexpected());
    expect(presign).not.toHaveBeenCalled();
  });

  it('reads provider metadata and only the requested byte range', async () => {
    const data = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
    send
      .mockResolvedValueOnce({
        ContentType: 'image/png',
        ContentLength: 1024,
        Metadata: { 'original-name': 'cmVjZWlwdC5wbmc' },
      } as never)
      .mockResolvedValueOnce({
        Body: {
          transformToByteArray: jest.fn().mockResolvedValue(data),
        },
      } as never);

    await expect(
      makeBlackblazeClient(config).readFile({
        key: 'users/id/reference',
        range: { start: 0, end: 11 },
      })
    ).resolves.toEqual({
      fileUrl:
        'https://s3.us-west-004.backblazeb2.com/drimsheet-files/users/id/reference',
      contentType: 'image/png',
      size: 1024,
      metadata: { 'original-name': 'cmVjZWlwdC5wbmc' },
      data,
    });

    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
    expect((send.mock.calls[0][0] as HeadObjectCommand).input).toEqual({
      Bucket: 'drimsheet-files',
      Key: 'users/id/reference',
    });
    expect(send.mock.calls[1][0]).toBeInstanceOf(GetObjectCommand);
    expect((send.mock.calls[1][0] as GetObjectCommand).input).toEqual({
      Bucket: 'drimsheet-files',
      Key: 'users/id/reference',
      Range: 'bytes=0-11',
    });
  });

  it('reads the complete object when no byte range is supplied', async () => {
    send
      .mockResolvedValueOnce({ ContentLength: 4 } as never)
      .mockResolvedValueOnce({
        Body: {
          transformToByteArray: jest
            .fn()
            .mockResolvedValue(Uint8Array.from([1, 2, 3, 4])),
        },
      } as never);

    await expect(
      makeBlackblazeClient(config).readFile({ key: 'files/id' })
    ).resolves.toMatchObject({
      size: 4,
      data: Uint8Array.from([1, 2, 3, 4]),
    });
    expect((send.mock.calls[1][0] as GetObjectCommand).input).toEqual({
      Bucket: 'drimsheet-files',
      Key: 'files/id',
      Range: undefined,
    });
  });

  it('maps a missing object to a null read', async () => {
    send.mockRejectedValueOnce({
      name: 'NotFound',
      $metadata: { httpStatusCode: 404 },
    } as never);

    await expect(
      makeBlackblazeClient(config).readFile({
        key: 'files/missing',
        range: { start: 0, end: 11 },
      })
    ).resolves.toBeNull();
  });

  it.each([
    { name: 'NoSuchKey' },
    { name: 'OtherError', $metadata: { httpStatusCode: 404 } },
  ])('recognizes each supported missing-object response', async (error) => {
    send.mockRejectedValueOnce(error as never);

    await expect(
      makeBlackblazeClient(config).readFile({
        key: 'files/missing',
        range: { start: 0, end: 11 },
      })
    ).resolves.toBeNull();
  });

  it('maps absent optional storage metadata to empty storage values', async () => {
    send.mockResolvedValueOnce({} as never).mockResolvedValueOnce({} as never);

    await expect(
      makeBlackblazeClient(config).readFile({
        key: 'files/incomplete',
        range: { start: 0, end: 11 },
      })
    ).resolves.toEqual({
      fileUrl:
        'https://s3.us-west-004.backblazeb2.com/drimsheet-files/files/incomplete',
      contentType: '',
      size: 0,
      metadata: {},
      data: new Uint8Array(),
    });
  });

  it('maps unexpected storage read failures', async () => {
    send.mockRejectedValueOnce(new Error('provider detail') as never);

    await expect(
      makeBlackblazeClient(config).readFile({
        key: 'files/id',
        range: { start: 0, end: 11 },
      })
    ).rejects.toThrow(fileAppError.ReadUnexpected);
  });

  it('maps non-object storage read failures', async () => {
    send.mockRejectedValueOnce('provider detail' as never);

    await expect(
      makeBlackblazeClient(config).readFile({
        key: 'files/id',
        range: { start: 0, end: 11 },
      })
    ).rejects.toThrow(fileAppError.ReadUnexpected);
  });

  it('deletes an object by key', async () => {
    await makeBlackblazeClient(config).deleteFile('files/id');

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
    expect((send.mock.calls[0][0] as DeleteObjectCommand).input).toEqual({
      Bucket: 'drimsheet-files',
      Key: 'files/id',
    });
  });

  it('maps deletion failures', async () => {
    send.mockRejectedValueOnce(new Error('provider detail') as never);

    await expect(
      makeBlackblazeClient(config).deleteFile('files/id')
    ).rejects.toThrow(fileAppError.DeleteUnexpected);
  });
});
