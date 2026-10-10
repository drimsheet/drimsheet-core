import stringUtils from '@shared/utils/string';
import generateUUID from '@shared/utils/uuid-generator';
import fileAttachmentValue from '@shared/values/file-attachments/file-attachment.vo';
import { IFileAttachment } from '@shared/values/file-attachments/types/file-attachment.types';

import IFileManagementAppService, {
  IClaimManagedFileUploadsPayload,
} from '@app/file/contracts/file-management.service.contract';
import IFileStorageClient from '@app/file/contracts/file-storage-client.contract';
import fileAppError from '@app/file/errors/file.error';
import fileUploadPolicy from '@app/file/policies/file-upload.policy';
import { UFileUploadPurpose } from '@app/file/types/file.types';

const ORIGINAL_NAME_METADATA_KEY = 'original-name';

interface IDependencies {
  fileStorageClient: IFileStorageClient;
}

/**
 * Restores and validates an original filename stored in object metadata.
 */
function decodeOriginalName(metadata: Readonly<Record<string, string>>) {
  const encodedName = metadata[ORIGINAL_NAME_METADATA_KEY];
  if (!encodedName || !/^[A-Za-z0-9_-]+$/.test(encodedName)) {
    throw new fileAppError.InvalidUploadReference();
  }

  const decodedName = Buffer.from(encodedName, 'base64url').toString('utf8');
  if (
    Buffer.from(decodedName, 'utf8').toString('base64url') !== encodedName ||
    !stringUtils.isNonEmptyString(decodedName)
  ) {
    throw new fileAppError.InvalidUploadReference();
  }

  return decodedName;
}

/**
 * Removes an invalid stored file and maps provider failures to a stable error.
 */
async function deleteInvalidFile(deps: IDependencies, key: string) {
  try {
    await deps.fileStorageClient.deleteFile(key);
  } catch (error) {
    if (error instanceof fileAppError.DeleteUnexpected) throw error;
    throw new fileAppError.DeleteUnexpected();
  }
}

/**
 * Reads and validates one uploaded object, returning its canonical attachment.
 */
async function claimUpload(
  deps: IDependencies,
  payload: IClaimManagedFileUploadsPayload,
  reference: string
): Promise<IFileAttachment> {
  if (!stringUtils.isUUID(reference)) {
    throw new fileAppError.InvalidUploadReference({ reference });
  }

  const key = `${payload.userId}/${payload.purpose}/${reference}`;
  let storedFile;

  try {
    storedFile = await deps.fileStorageClient.readFile({
      key,
      range: {
        start: 0,
        end: fileUploadPolicy.signatureByteCount - 1,
      },
    });
  } catch {
    throw new fileAppError.ClaimUnexpected();
  }

  if (!storedFile) {
    throw new fileAppError.InvalidUploadReference({ reference });
  }

  try {
    const name = decodeOriginalName(storedFile.metadata);
    const type = fileUploadPolicy.validateStoredFile(
      payload.purpose,
      storedFile.contentType,
      storedFile.size,
      storedFile.data
    );

    return fileAttachmentValue.make({
      url: storedFile.fileUrl,
      name,
      type,
      size: storedFile.size,
    });
  } catch (error) {
    if (!(error instanceof fileAppError.Base)) {
      throw new fileAppError.ClaimUnexpected();
    }

    await deleteInvalidFile(deps, key);
    throw error;
  }
}

/** Creates the capability that pre-signs purpose-scoped uploads. */
function makePreSignUploads(
  deps: IDependencies
): IFileManagementAppService['preSignUploads'] {
  return async (payload) => {
    try {
      const fileCounts = new Map<UFileUploadPurpose, number>();

      for (const file of payload.files) {
        fileCounts.set(file.purpose, (fileCounts.get(file.purpose) ?? 0) + 1);
      }

      for (const [purpose, count] of fileCounts) {
        fileUploadPolicy.validateCount(purpose, count);
      }

      const uploadRequests = payload.files.map((file) => {
        const contentType = fileUploadPolicy.validateType(
          file.purpose,
          file.type
        );
        fileUploadPolicy.validateSize(file.purpose, file.size);

        return {
          file,
          contentType,
          reference: generateUUID(),
          encodedName: Buffer.from(file.name, 'utf8').toString('base64url'),
        };
      });

      const signedUploads = await Promise.all(
        uploadRequests.map(async (uploadRequest) => {
          const upload = await deps.fileStorageClient.preSignUpload({
            key: `${payload.userId}/${uploadRequest.file.purpose}/${uploadRequest.reference}`,
            contentType: uploadRequest.contentType,
            metadata: Object.freeze({
              [ORIGINAL_NAME_METADATA_KEY]: uploadRequest.encodedName,
            }),
          });

          const attachment = fileAttachmentValue.make({
            url: upload.fileUrl,
            name: uploadRequest.file.name,
            type: uploadRequest.contentType,
            size: uploadRequest.file.size,
          });

          return Object.freeze({
            uploadUrl: upload.uploadUrl,
            reference: uploadRequest.reference,
            headers: upload.headers,
            file: Object.freeze({
              url: attachment.url,
              name: attachment.name,
              type: attachment.type,
              size: attachment.size,
            }),
          });
        })
      );

      return signedUploads;
    } catch (error) {
      if (error instanceof fileAppError.Base) throw error;
      throw new fileAppError.UploadUnexpected();
    }
  };
}

/**
 * Creates the capability that claims uploaded files in reference order.
 */
function makeClaimUploads(
  deps: IDependencies
): IFileManagementAppService['claimUploads'] {
  return async (payload) => {
    fileUploadPolicy.validateCount(payload.purpose, payload.references.length);

    const attachments: IFileAttachment[] = [];

    for (const reference of payload.references) {
      attachments.push(await claimUpload(deps, payload, reference));
    }

    return Object.freeze(attachments) as IFileAttachment[];
  };
}

/**
 * Composes the immutable file-management service from its capabilities.
 */
export default function makeFileManagementAppService(deps: IDependencies) {
  const service: IFileManagementAppService = {
    preSignUploads: makePreSignUploads(deps),

    claimUploads: makeClaimUploads(deps),
  };

  return Object.freeze(service);
}
