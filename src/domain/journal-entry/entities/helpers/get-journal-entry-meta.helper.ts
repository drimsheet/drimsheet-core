import fileAttachmentValue from '@shared/values/file-attachments/file-attachment.vo';
import { IFileAttachment } from '@shared/values/file-attachments/types/file-attachment.types';

export default function getJournalEntryMetaHelper(
  fileExtractionSource?: IFileAttachment
) {
  return fileExtractionSource
    ? Object.freeze({
        fileExtractionSource: fileAttachmentValue.make(fileExtractionSource),
      })
    : null;
}
