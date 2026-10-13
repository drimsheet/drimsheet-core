import fileAttachmentError from '@shared/values/file-attachments/file-attachment.error';

import { fileUploadReqValidation } from '@app/file/dtos/file-upload/file-upload.dto.validation';
import fileAppError from '@app/file/errors/file.error';
import { EFileUploadPurpose } from '@app/file/types/file.types';

describe('fileUploadReqValidation', () => {
  it('rejects an empty upload collection', () => {
    const result = fileUploadReqValidation.safeParse([]);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        new fileAppError.InvalidUploadCount().errorKey
      );
    }
  });

  it('accepts valid file metadata', () => {
    const result = fileUploadReqValidation.safeParse([
      {
        name: '  Réçeipt (FINAL).png  ',
        type: 'image/png',
        size: 1024,
        purpose: EFileUploadPurpose.JournalEntryAttachment,
      },
    ]);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0].name).toBe('  Réçeipt (FINAL).png  ');
    }
  });

  it('leaves purpose-specific count validation to the service', () => {
    const file = {
      name: 'receipt.png',
      type: 'image/png',
      size: 1024,
      purpose: EFileUploadPurpose.JournalEntryAttachment,
    };
    const result = fileUploadReqValidation.safeParse([
      file,
      { ...file, name: 'invoice.png' },
    ]);

    expect(result.success).toBe(true);
  });

  it.each([
    [
      'name',
      {
        name: ' ',
        type: 'image/png',
        size: 1024,
        purpose: EFileUploadPurpose.JournalEntryAttachment,
      },
      new fileAttachmentError.InvalidName().errorKey,
    ],
    [
      'type',
      {
        name: 'receipt.png',
        type: ' ',
        size: 1024,
        purpose: EFileUploadPurpose.JournalEntryAttachment,
      },
      new fileAttachmentError.InvalidType().errorKey,
    ],
    [
      'size',
      {
        name: 'receipt.png',
        type: 'image/png',
        size: 0,
        purpose: EFileUploadPurpose.JournalEntryAttachment,
      },
      new fileAttachmentError.InvalidSize().errorKey,
    ],
    [
      'purpose',
      {
        name: 'receipt.png',
        type: 'image/png',
        size: 1024,
        purpose: 'unknown',
      },
      new fileAppError.InvalidUploadPurpose().errorKey,
    ],
  ])('rejects an invalid %s', (_field, payload, errorKey) => {
    const result = fileUploadReqValidation.safeParse([payload]);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(errorKey);
    }
  });
});
