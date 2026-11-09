import fileAppError from '@app/file/errors/file.error';
import fileUploadPolicy from '@app/file/policies/file-upload.policy';
import { EFileUploadPurpose } from '@app/file/types/file.types';

describe('fileUploadPolicy', () => {
  const purpose = EFileUploadPurpose.JournalEntryAttachment;

  it('rejects an unsupported purpose at the policy boundary', () => {
    expect(() =>
      fileUploadPolicy.validateType('unknown' as typeof purpose, 'image/png')
    ).toThrow(fileAppError.InvalidUploadPurpose);
  });

  it.each(['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])(
    'accepts the %s MIME type at the 5 MiB limit',
    (type) => {
      expect(
        fileUploadPolicy.validateType(purpose, ` ${type.toUpperCase()} `)
      ).toBe(type);
      expect(() =>
        fileUploadPolicy.validateSize(purpose, 5 * 1024 * 1024)
      ).not.toThrow();
    }
  );

  it('exposes the journal-entry attachment file limit', () => {
    expect(fileUploadPolicy.getPolicy(purpose).maxFiles).toBe(1);
  });

  it.each([0, 1])('accepts the valid upload count %s', (count) => {
    expect(() => fileUploadPolicy.validateCount(purpose, count)).not.toThrow();
  });

  it.each([2, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects the invalid upload count %s',
    (count) => {
      expect(() => fileUploadPolicy.validateCount(purpose, count)).toThrow(
        fileAppError.InvalidUploadCount
      );
    }
  );

  it.each(['image/svg+xml', 'image/gif', 'text/plain'])(
    'rejects the %s MIME type',
    (type) => {
      expect(() => fileUploadPolicy.validateType(purpose, type)).toThrow(
        fileAppError.InvalidUploadType
      );
    }
  );

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 5 * 1024 * 1024 + 1])(
    'rejects the invalid size %s',
    (size) => {
      expect(() => fileUploadPolicy.validateSize(purpose, size)).toThrow(
        fileAppError.InvalidUploadSize
      );
    }
  );

  it.each([
    ['image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]],
    ['image/jpeg', [0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    [
      'image/webp',
      [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
    ],
    ['application/pdf', [0x25, 0x50, 0x44, 0x46, 0x2d, 0, 0, 0, 0, 0, 0, 0]],
  ] as const)('accepts matching %s bytes', (type, bytes) => {
    expect(
      fileUploadPolicy.validateStoredFile(
        purpose,
        type,
        1,
        Uint8Array.from(bytes)
      )
    ).toBe(type);
  });

  it('rejects a stored MIME type that does not match its signature', () => {
    expect(() =>
      fileUploadPolicy.validateStoredFile(
        purpose,
        'image/png',
        1,
        Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0, 0, 0, 0, 0, 0, 0])
      )
    ).toThrow(fileAppError.InvalidUploadType);
  });

  it('rejects unrecognized stored bytes', () => {
    expect(() =>
      fileUploadPolicy.validateStoredFile(
        purpose,
        'image/png',
        1,
        Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
      )
    ).toThrow(fileAppError.InvalidUploadType);
  });
});
