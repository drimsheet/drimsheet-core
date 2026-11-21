import fileAttachmentError from '@shared/values/file-attachments/file-attachment.error';
import fileAttachment from '@shared/values/file-attachments/file-attachment.vo';
import { EFileAttachmentType } from '@shared/values/file-attachments/types/file-attachment.types';

describe('FileAttachment Value Object', () => {
  const validPayload = {
    url: 'https://example.com/file.pdf',
    name: 'receipt.pdf',
    type: 'application/pdf',
    size: 1024,
  };

  describe('make', () => {
    it('should create a frozen file attachment from valid payload', () => {
      const result = fileAttachment.make(validPayload);

      expect(result.url).toBe(validPayload.url);
      expect(result.name).toBe(validPayload.name);
      expect(result.type).toBe(EFileAttachmentType.Pdf);
      expect(result.size).toBe(validPayload.size);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should preserve the original name and normalize the type', () => {
      const result = fileAttachment.make({
        ...validPayload,
        name: '  Réçeipt (FINAL).pdf  ',
        type: '  APPLICATION/PDF  ',
      });

      expect(result.name).toBe('  Réçeipt (FINAL).pdf  ');
      expect(result.type).toBe(EFileAttachmentType.Pdf);
    });

    it.each([
      ['pdf', EFileAttachmentType.Pdf],
      ['application/pdf', EFileAttachmentType.Pdf],
      ['excel', EFileAttachmentType.Excel],
      ['xls', EFileAttachmentType.Excel],
      ['xlsx', EFileAttachmentType.Excel],
      ['application/vnd.ms-excel', EFileAttachmentType.Excel],
      [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        EFileAttachmentType.Excel,
      ],
      ['jpg', EFileAttachmentType.Jpg],
      ['jpeg', EFileAttachmentType.Jpg],
      ['image/jpeg', EFileAttachmentType.Jpg],
      ['png', EFileAttachmentType.Png],
      ['image/png', EFileAttachmentType.Png],
      ['csv', EFileAttachmentType.Csv],
      ['text/csv', EFileAttachmentType.Csv],
    ])('maps %s to the supported attachment type', (type, expected) => {
      const attachment = fileAttachment.make({ ...validPayload, type });

      expect(attachment.type).toBe(expected);
      expect(fileAttachment.make(attachment)).toEqual(attachment);
    });

    it.each([
      'image/webp',
      'image/gif',
      'application/octet-stream',
      'application/msword',
      'unknown',
      'constructor',
      '__proto__',
      '   ',
      null,
      undefined,
      42,
    ])('rejects unsupported attachment type %s', (type) => {
      expect(() =>
        fileAttachment.make({
          ...validPayload,
          type: type as string,
        })
      ).toThrow(fileAttachmentError.InvalidType);
    });

    it('should throw InvalidUrl for non-URL string', () => {
      expect(() =>
        fileAttachment.make({ ...validPayload, url: 'not-a-url' })
      ).toThrow(fileAttachmentError.InvalidUrl);
    });

    it('should throw InvalidUrl for empty URL', () => {
      expect(() => fileAttachment.make({ ...validPayload, url: '' })).toThrow(
        fileAttachmentError.InvalidUrl
      );
    });

    it('should throw InvalidName for empty name', () => {
      expect(() => fileAttachment.make({ ...validPayload, name: '' })).toThrow(
        fileAttachmentError.InvalidName
      );
    });

    it('should throw InvalidName for whitespace-only name', () => {
      expect(() =>
        fileAttachment.make({ ...validPayload, name: '   ' })
      ).toThrow(fileAttachmentError.InvalidName);
    });

    it('should throw InvalidType for empty type', () => {
      expect(() => fileAttachment.make({ ...validPayload, type: '' })).toThrow(
        fileAttachmentError.InvalidType
      );
    });

    it('should throw InvalidSize for zero size', () => {
      expect(() => fileAttachment.make({ ...validPayload, size: 0 })).toThrow(
        fileAttachmentError.InvalidSize
      );
    });

    it('should throw InvalidSize for negative size', () => {
      expect(() =>
        fileAttachment.make({ ...validPayload, size: -100 })
      ).toThrow(fileAttachmentError.InvalidSize);
    });

    it('should throw InvalidSize for non-number size', () => {
      expect(() =>
        fileAttachment.make({
          ...validPayload,
          size: 'big' as unknown as number,
        })
      ).toThrow(fileAttachmentError.InvalidSize);
    });
  });

  describe('validate', () => {
    it('should not throw for a valid attachment', () => {
      const attachment = fileAttachment.make(validPayload);
      expect(() => fileAttachment.validate(attachment)).not.toThrow();
    });

    it('should throw for invalid url', () => {
      expect(() =>
        fileAttachment.validate({ ...validPayload, url: 'bad' })
      ).toThrow(fileAttachmentError.InvalidUrl);
    });

    it('should throw for invalid size', () => {
      expect(() =>
        fileAttachment.validate({ ...validPayload, size: -1 })
      ).toThrow(fileAttachmentError.InvalidSize);
    });
  });

  describe('validateMany', () => {
    it('should not throw for an empty array', () => {
      expect(() => fileAttachment.validateMany([])).not.toThrow();
    });

    it('should not throw for an array of valid attachments', () => {
      const attachments = [
        fileAttachment.make(validPayload),
        fileAttachment.make({
          ...validPayload,
          name: 'invoice.pdf',
        }),
      ];
      expect(() => fileAttachment.validateMany(attachments)).not.toThrow();
    });

    it('should throw for non-array input', () => {
      expect(() =>
        fileAttachment.validateMany(
          'invalid' as unknown as Parameters<
            typeof fileAttachment.validateMany
          >[0]
        )
      ).toThrow(fileAttachmentError.InvalidAttachments);
    });

    it('should throw if any attachment in the array is invalid', () => {
      const attachments = [
        fileAttachment.make(validPayload),
        { ...validPayload, url: 'not-a-url' },
      ];
      expect(() => fileAttachment.validateMany(attachments)).toThrow(
        fileAttachmentError.InvalidUrl
      );
    });
  });
});
