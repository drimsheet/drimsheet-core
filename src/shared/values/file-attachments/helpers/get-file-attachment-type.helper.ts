import stringUtils from '@shared/utils/string';
import fileAttachmentError from '@shared/values/file-attachments/file-attachment.error';
import {
  EFileAttachmentType,
  UFileAttachmentType,
} from '@shared/values/file-attachments/types/file-attachment.types';

const fileAttachmentTypes = new Map<string, UFileAttachmentType>([
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
]);

/** Resolves a supported type name or MIME type, rejecting unsupported input. */
export default function getFileAttachmentTypeHelper(
  type: string
): UFileAttachmentType {
  if (!stringUtils.isNonEmptyString(type)) {
    throw new fileAttachmentError.InvalidType({ type });
  }

  const fileType = fileAttachmentTypes.get(type.trim().toLowerCase());
  if (fileType === undefined) {
    throw new fileAttachmentError.InvalidType({ type });
  }

  return fileType;
}
