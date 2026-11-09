import { TEntityId } from '@shared/types/uuid';
import { IFileAttachment } from '@shared/values/file-attachments/types/file-attachment.types';

import IFileManagementAppService from '@app/file/contracts/file-management.service.contract';
import { EFileUploadPurpose } from '@app/file/types/file.types';
import { IJournalEntryAttachmentsUpdateReq } from '@app/journal-entry/dtos/journal-entry/journal-entry-attachments.dto';

/** Resolves upload references and removes files by their exact stored URLs. */
export default async function resolveJournalAttachmentsHelper(
  fileManagementAppService: IFileManagementAppService,
  userId: TEntityId,
  currentAttachments: IFileAttachment[],
  patch?: IJournalEntryAttachmentsUpdateReq
): Promise<IFileAttachment[] | undefined> {
  if (patch === undefined) {
    return undefined;
  }

  const removedUrls = new Set(patch.remove);
  const retained = currentAttachments.filter(
    (file) => !removedUrls.has(file.url)
  );
  if (!patch.add?.length) {
    return retained;
  }

  const claimed = await fileManagementAppService.claimUploads({
    userId,
    purpose: EFileUploadPurpose.JournalEntryAttachment,
    references: patch.add,
  });
  const retainedUrls = new Set(retained.map((file) => file.url));
  const additions = claimed.filter((file) => !retainedUrls.has(file.url));
  return [...retained, ...additions];
}
