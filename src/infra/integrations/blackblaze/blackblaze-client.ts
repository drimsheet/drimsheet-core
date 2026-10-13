import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import IFileStorageClient from '@app/file/contracts/file-storage-client.contract';
import fileAppError from '@app/file/errors/file.error';

const UPLOAD_URL_EXPIRY_SECONDS = 5 * 60;

interface IBlackblazeConfig {
  appKeyId: string;
  appKey: string;
  bucketName: string;
  endpoint: string;
  region: string;
}

interface IDependencies {
  getClient: () => S3Client;
  config: IBlackblazeConfig;
}

/**
 * Removes the expiring signature from a presigned upload URL.
 */
function getStableFileUrl(uploadUrl: string): string {
  const fileUrl = new URL(uploadUrl);
  fileUrl.search = '';
  fileUrl.hash = '';
  return fileUrl.toString();
}

/**
 * Builds the stable public URL for an object stored under the supplied key.
 */
function getFileUrl(config: IBlackblazeConfig, key: string) {
  const endpoint = new URL(config.endpoint);
  const path = [config.bucketName, ...key.split('/')]
    .map(encodeURIComponent)
    .join('/');
  endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/${path}`;
  endpoint.search = '';
  endpoint.hash = '';
  return endpoint.toString();
}

/**
 * Identifies provider responses that mean the requested object does not exist.
 */
function isMissingObjectError(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const response = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    response.name === 'NotFound' ||
    response.name === 'NoSuchKey' ||
    response.$metadata?.httpStatusCode === 404
  );
}

/**
 * Creates the storage capability that prepares a presigned object write.
 */
function makePreSignUpload(
  deps: IDependencies
): IFileStorageClient['preSignUpload'] {
  return async ({ key, contentType, metadata }) => {
    try {
      const metadataHeaders = Object.keys(metadata).map(
        (name) => `x-amz-meta-${name}`
      );
      const uploadUrl = await getSignedUrl(
        deps.getClient(),
        new PutObjectCommand({
          Bucket: deps.config.bucketName,
          Key: key,
          ContentType: contentType,
          Metadata: metadata,
        }),
        {
          expiresIn: UPLOAD_URL_EXPIRY_SECONDS,
          unhoistableHeaders: new Set(metadataHeaders),
        }
      );

      return Object.freeze({
        uploadUrl,
        fileUrl: getStableFileUrl(uploadUrl),
        headers: Object.freeze({
          'Content-Type': contentType,
          ...Object.fromEntries(
            Object.entries(metadata).map(([name, value]) => [
              `x-amz-meta-${name}`,
              value,
            ])
          ),
        }),
      });
    } catch {
      throw new fileAppError.UploadUnexpected();
    }
  };
}

/**
 * Creates the storage capability that reads object data and provider metadata.
 */
function makeReadFile(deps: IDependencies): IFileStorageClient['readFile'] {
  return async ({ key, range }) => {
    try {
      const head = await deps.getClient().send(
        new HeadObjectCommand({
          Bucket: deps.config.bucketName,
          Key: key,
        })
      );
      const response = await deps.getClient().send(
        new GetObjectCommand({
          Bucket: deps.config.bucketName,
          Key: key,
          Range: range ? `bytes=${range.start}-${range.end}` : undefined,
        })
      );
      const data =
        (await response.Body?.transformToByteArray()) ?? new Uint8Array();

      return Object.freeze({
        fileUrl: getFileUrl(deps.config, key),
        contentType: head.ContentType ?? '',
        size: head.ContentLength ?? 0,
        metadata: Object.freeze({ ...(head.Metadata ?? {}) }),
        data,
      });
    } catch (error) {
      if (isMissingObjectError(error)) {
        return null;
      }
      throw new fileAppError.ReadUnexpected();
    }
  };
}

/**
 * Creates the storage capability that deletes an object by key.
 */
function makeDeleteFile(deps: IDependencies): IFileStorageClient['deleteFile'] {
  return async (key) => {
    try {
      await deps.getClient().send(
        new DeleteObjectCommand({
          Bucket: deps.config.bucketName,
          Key: key,
        })
      );
    } catch {
      throw new fileAppError.DeleteUnexpected();
    }
  };
}

/**
 * Composes an immutable Backblaze storage client from its I/O capabilities.
 */
export default function makeBlackblazeClient(
  config: IBlackblazeConfig
): IFileStorageClient {
  let client: S3Client | undefined;
  const deps: IDependencies = {
    getClient: () => {
      client ??= new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        credentials: {
          accessKeyId: config.appKeyId,
          secretAccessKey: config.appKey,
        },
      });

      return client;
    },
    config,
  };
  const storageClient: IFileStorageClient = {
    preSignUpload: makePreSignUpload(deps),
    readFile: makeReadFile(deps),
    deleteFile: makeDeleteFile(deps),
  };

  return Object.freeze(storageClient);
}
