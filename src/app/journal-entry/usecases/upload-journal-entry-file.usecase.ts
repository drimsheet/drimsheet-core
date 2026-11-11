/**
 * SUMMARY
 * Claims and validates a completed journal-entry creation upload belonging to
 * the authenticated user.
 *
 * WHEN TO USE
 * Use after uploading a file with the journal_entry_creation purpose.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */
import IAppContextService from '@shared/contracts/app-context.service.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import { IAppContextData } from '@app/context/types/app-context.types';
import IFileManagementAppService from '@app/file/contracts/file-management.service.contract';
import { EFileUploadPurpose } from '@app/file/types/file.types';
import { IJournalEntryUploadReq } from '@app/journal-entry/dtos/journal-entry-upload/journal-entry-upload.dto';
import { journalEntryUploadReqValidation } from '@app/journal-entry/dtos/journal-entry-upload/journal-entry-upload.dto.validation';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  fileManagementAppService: IFileManagementAppService;
}

export default function makeUploadJournalEntryFileUsecase(deps: IDependencies) {
  return async (payload: IJournalEntryUploadReq): Promise<void> => {
    zodValidationRunner(journalEntryUploadReqValidation, payload);

    const { user } = deps.appContext.get(['user', 'accountingEntity']);

    await deps.fileManagementAppService.claimUploads({
      userId: user.id,
      purpose: EFileUploadPurpose.JournalEntryCreation,
      references: [payload.reference],
    });

    // TODO: add to queue
  };
}
