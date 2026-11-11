import fileAttachmentError from '@shared/values/file-attachments/file-attachment.error';
import fileAttachmentValue from '@shared/values/file-attachments/file-attachment.vo';
import fileAttachmentValidation from '@shared/values/file-attachments/validations/file-attachment.validation';

describe('fileAttachmentValidation', () => {
  const attachment = fileAttachmentValue.make({
    url: 'https://example.com/receipt.pdf',
    name: 'receipt.pdf',
    type: 'application/pdf',
    size: 1024,
  });

  it('exposes frozen validations and accepts constructed attachments', () => {
    expect(Object.isFrozen(fileAttachmentValidation)).toBe(true);
    expect(() => fileAttachmentValidation.validate(attachment)).not.toThrow();
    expect(() =>
      fileAttachmentValidation.validateMany([attachment])
    ).not.toThrow();
    expect(() => fileAttachmentValidation.validateMany([])).not.toThrow();
  });

  it.each(['application/pdf', '  IMAGE/JPEG  ', 'xlsx', 'png', 'text/csv'])(
    'accepts supported type strings %s',
    (type) => {
      expect(() => fileAttachmentValidation.validateType(type)).not.toThrow();
    }
  );

  it.each(['', ' ', 'image/webp', 'application/msword', 'toString'])(
    'rejects unsupported type strings %s',
    (type) => {
      expect(() => fileAttachmentValidation.validateType(type)).toThrow(
        fileAttachmentError.InvalidType
      );
    }
  );

  it.each([
    [{ url: 'bad' }, fileAttachmentError.InvalidUrl],
    [{ name: '' }, fileAttachmentError.InvalidName],
    [{ type: 'image/gif' }, fileAttachmentError.InvalidType],
    [{ size: 0 }, fileAttachmentError.InvalidSize],
    [{ size: -1 }, fileAttachmentError.InvalidSize],
    [{ size: 'big' as unknown as number }, fileAttachmentError.InvalidSize],
  ] as const)('rejects invalid attachment fields %s', (changes, error) => {
    expect(() =>
      fileAttachmentValidation.validate({ ...attachment, ...changes })
    ).toThrow(error);
  });

  it('rejects a collection containing an unsupported type', () => {
    expect(() =>
      fileAttachmentValidation.validateMany([
        attachment,
        { ...attachment, type: 'image/webp' },
      ])
    ).toThrow(fileAttachmentError.InvalidType);
  });

  it('rejects a non-array attachment collection', () => {
    expect(() =>
      fileAttachmentValidation.validateMany(
        null as unknown as Parameters<
          typeof fileAttachmentValidation.validateMany
        >[0]
      )
    ).toThrow(fileAttachmentError.InvalidAttachments);
  });
});
