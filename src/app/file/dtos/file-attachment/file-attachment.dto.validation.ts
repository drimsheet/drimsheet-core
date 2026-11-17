import z from 'zod';

import stringUtils from '@shared/utils/string';
import fileAttachmentError from '@shared/values/file-attachments/file-attachment.error';
import getFileAttachmentTypeHelper from '@shared/values/file-attachments/helpers/get-file-attachment-type.helper';
import { IFileAttachment } from '@shared/values/file-attachments/types/file-attachment.types';

const invalidFileUrlKey = new fileAttachmentError.InvalidUrl().errorKey;
const invalidFileNameKey = new fileAttachmentError.InvalidName().errorKey;
const invalidFileTypeKey = new fileAttachmentError.InvalidType().errorKey;
const invalidFileSizeKey = new fileAttachmentError.InvalidSize().errorKey;

export const fileAttachmentDtoValidation = z.object({
  url: z.string(invalidFileUrlKey).refine(stringUtils.isUrl, invalidFileUrlKey),
  name: z
    .string(invalidFileNameKey)
    .refine(stringUtils.isNonEmptyString, invalidFileNameKey),
  type: z.string(invalidFileTypeKey).refine((type) => {
    try {
      getFileAttachmentTypeHelper(type);
      return true;
    } catch {
      return false;
    }
  }, invalidFileTypeKey),
  size: z.number(invalidFileSizeKey).positive(invalidFileSizeKey),
}) satisfies z.ZodType<IFileAttachment>;
