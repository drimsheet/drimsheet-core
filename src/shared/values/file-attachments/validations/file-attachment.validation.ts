import stringUtils from '@shared/utils/string';
import fileAttachmentError from '@shared/values/file-attachments/file-attachment.error';
import getFileAttachmentTypeHelper from '@shared/values/file-attachments/helpers/get-file-attachment-type.helper';
import { IFileAttachment } from '@shared/values/file-attachments/types/file-attachment.types';

/** Validates a URL string. */
function validateUrl(url: string) {
  if (!stringUtils.isUrl(url)) {
    throw new fileAttachmentError.InvalidUrl({ url });
  }
}

/** Validates an attachment name. */
function validateName(name: string) {
  if (!stringUtils.isNonEmptyString(name)) {
    throw new fileAttachmentError.InvalidName({ name });
  }
}

/** Validates that an attachment type can be resolved to a supported type. */
function validateType(type: string) {
  getFileAttachmentTypeHelper(type);
}

/** Validates an attachment file size. */
function validateSize(size: number) {
  if (typeof size !== 'number' || size <= 0) {
    throw new fileAttachmentError.InvalidSize({ size });
  }
}

/** Validates an existing file attachment object. */
function validate(attachment: IFileAttachment) {
  validateUrl(attachment.url);
  validateName(attachment.name);
  validateType(attachment.type);
  validateSize(attachment.size);
}

/** Validates an array of file attachments. */
function validateMany(attachments: IFileAttachment[]) {
  if (!Array.isArray(attachments)) {
    throw new fileAttachmentError.InvalidAttachments({ attachments });
  }
  for (const attachment of attachments) {
    validate(attachment);
  }
}

const fileAttachmentValidation = Object.freeze({
  validateUrl,
  validateName,
  validateType,
  validateSize,
  validate,
  validateMany,
});

export default fileAttachmentValidation;
