import z from 'zod';

import fileAttachmentError from '@shared/values/file-attachments/file-attachment.error';

import fileAppError from '@app/file/errors/file.error';
import fileUploadPolicy from '@app/file/policies/file-upload.policy';
import { EFileUploadPurpose } from '@app/file/types/file.types';

const invalidAttachmentReferenceKey = new fileAppError.InvalidUploadReference()
  .errorKey;
const maxAttachmentReferences = fileUploadPolicy.getPolicy(
  EFileUploadPurpose.JournalEntryAttachment
).maxFiles;

export const attachmentReferencesValidation = z
  .array(z.uuid(invalidAttachmentReferenceKey))
  .max(maxAttachmentReferences, new fileAppError.InvalidUploadCount().errorKey)
  .refine(
    (references) => new Set(references).size === references.length,
    invalidAttachmentReferenceKey
  )
  .optional();

export const journalEntryAttachmentsUpdateReqValidation = z
  .strictObject({
    add: attachmentReferencesValidation,
    remove: z
      .array(z.url(new fileAttachmentError.InvalidUrl().errorKey))
      .optional(),
  })
  .optional();
