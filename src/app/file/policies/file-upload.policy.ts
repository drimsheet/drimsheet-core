import fileAppError from '@app/file/errors/file.error';
import {
  EFileUploadPurpose,
  UFileUploadPurpose,
} from '@app/file/types/file.types';

const JOURNAL_ENTRY_ATTACHMENT_MAX_BYTES = 2 * 1024 * 1024;
const FILE_SIGNATURE_BYTE_COUNT = 12;

interface IFileUploadPolicy {
  readonly maxBytes: number;
  readonly maxFiles: number;
  readonly permittedMimeTypes: readonly string[];
}

const fileUploadPolicies: Readonly<
  Record<UFileUploadPurpose, IFileUploadPolicy>
> = {
  [EFileUploadPurpose.JournalEntryAttachment]: {
    maxBytes: JOURNAL_ENTRY_ATTACHMENT_MAX_BYTES,
    maxFiles: 1,
    permittedMimeTypes: [
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/pdf',
    ],
  },
};

/** Returns the policy for a supported upload purpose. */
function getPolicy(purpose: UFileUploadPurpose) {
  const policy = fileUploadPolicies[purpose];

  if (!policy) {
    throw new fileAppError.InvalidUploadPurpose({ purpose });
  }

  return policy;
}

/** Validates the number of files submitted for an upload purpose. */
function validateCount(purpose: UFileUploadPurpose, count: number) {
  const { maxFiles } = getPolicy(purpose);

  if (!Number.isInteger(count) || count < 0 || count > maxFiles) {
    throw new fileAppError.InvalidUploadCount({ purpose, count, maxFiles });
  }
}

/** Validates and normalizes an upload MIME type. */
// TODO: Rename this value-returning validation to a check; reserve validate
// for checks that only throw on failure and return no value.
function validateType(purpose: UFileUploadPurpose, type: string) {
  const policy = getPolicy(purpose);
  const normalizedType = type.trim().toLowerCase();

  if (!policy.permittedMimeTypes.includes(normalizedType)) {
    throw new fileAppError.InvalidUploadType({ purpose, type });
  }

  return normalizedType;
}

/** Validates an upload's file size. */
function validateSize(purpose: UFileUploadPurpose, size: number) {
  const policy = getPolicy(purpose);
  if (!Number.isFinite(size) || size <= 0 || size > policy.maxBytes) {
    throw new fileAppError.InvalidUploadSize({ purpose, size });
  }
}

/** Checks whether bytes match a file signature. */
function startsWith(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

/** Detects a supported MIME type from signature bytes. */
function detectMimeType(bytes: Uint8Array) {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return 'application/pdf';
  }

  return null;
}

/** Validates stored file metadata and signature. */
// TODO: Rename this value-returning validation to a check; reserve validate
// for checks that only throw on failure and return no value.
function validateStoredFile(
  purpose: UFileUploadPurpose,
  type: string,
  size: number,
  leadingBytes: Uint8Array
) {
  const normalizedType = validateType(purpose, type);
  validateSize(purpose, size);

  if (detectMimeType(leadingBytes) !== normalizedType) {
    throw new fileAppError.InvalidUploadType({ purpose, type });
  }

  return normalizedType;
}

const fileUploadPolicy = Object.freeze({
  signatureByteCount: FILE_SIGNATURE_BYTE_COUNT,
  getPolicy,
  validateCount,
  validateType,
  validateSize,
  validateStoredFile,
});

export default fileUploadPolicy;
