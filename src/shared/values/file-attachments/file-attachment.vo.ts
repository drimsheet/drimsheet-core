import getFileAttachmentTypeHelper from '@shared/values/file-attachments/helpers/get-file-attachment-type.helper';
import { IFileAttachment } from '@shared/values/file-attachments/types/file-attachment.types';
import fileAttachmentValidation from '@shared/values/file-attachments/validations/file-attachment.validation';

/**
 * Creates a validated, frozen file attachment.
 */
function make(payload: IFileAttachment): IFileAttachment {
  fileAttachmentValidation.validateUrl(payload.url);
  fileAttachmentValidation.validateName(payload.name);
  const type = getFileAttachmentTypeHelper(payload.type);
  fileAttachmentValidation.validateSize(payload.size);

  return Object.freeze({
    url: payload.url,
    name: payload.name,
    type,
    size: payload.size,
  });
}

const fileAttachmentValue = Object.freeze({
  make,

  ...fileAttachmentValidation,
});

export default fileAttachmentValue;
