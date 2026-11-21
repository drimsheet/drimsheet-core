import { IFileAttachment } from '@shared/values/file-attachments/types/file-attachment.types';

import { fileAttachmentDtoValidation } from '@app/file/dtos/file-attachment/file-attachment.dto.validation';

describe('file attachment DTO validation', () => {
  const attachment: IFileAttachment = {
    url: 'https://example.com/receipt.pdf',
    name: 'receipt.pdf',
    type: 'pdf',
    size: 1024,
  };

  it.each([
    'pdf',
    'excel',
    'jpg',
    'png',
    'csv',
    'application/pdf',
    'image/jpeg',
  ])('accepts supported attachment type %s without changing it', (type) => {
    const input = { ...attachment, type };
    const parsed: IFileAttachment = fileAttachmentDtoValidation.parse(input);
    expect(parsed).toEqual(input);
  });

  it.each([
    {
      field: 'url',
      value: 'invalid',
      message: 'file_attachment_error_url_invalid',
    },
    {
      field: 'url',
      value: 'ftp://example.com/receipt.pdf',
      message: 'file_attachment_error_url_invalid',
    },
    {
      field: 'name',
      value: ' ',
      message: 'file_attachment_error_name_invalid',
    },
    {
      field: 'type',
      value: 'invalid',
      message: 'file_attachment_error_type_invalid',
    },
    { field: 'type', value: '', message: 'file_attachment_error_type_invalid' },
    { field: 'size', value: 0, message: 'file_attachment_error_size_invalid' },
    { field: 'size', value: -1, message: 'file_attachment_error_size_invalid' },
    {
      field: 'size',
      value: Infinity,
      message: 'file_attachment_error_size_invalid',
    },
  ])('reports invalid $field', ({ field, value, message }) => {
    const parsed = fileAttachmentDtoValidation.safeParse({
      ...attachment,
      [field]: value,
    });
    expect(parsed.error?.issues).toEqual([
      expect.objectContaining({ path: [field], message }),
    ]);
  });

  it.each(['url', 'name', 'type', 'size'])('rejects a missing %s', (field) => {
    expect(
      fileAttachmentDtoValidation.safeParse({
        ...attachment,
        [field]: undefined,
      }).success
    ).toBe(false);
  });

  it.each([undefined, null, {}])(
    'rejects an incomplete attachment %j',
    (input) => {
      expect(fileAttachmentDtoValidation.safeParse(input).success).toBe(false);
    }
  );
});
