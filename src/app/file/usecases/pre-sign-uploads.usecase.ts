/**
 * SUMMARY
 * Prepares uploads for the signed-in user from file names, content types,
 * sizes, and purposes. Enforces upload count, type, and size limits per
 * purpose.
 * Returns an upload URL, required headers, file metadata, and an opaque
 * reference for each file. Preparing uploads does not transfer file contents
 * or attach files to an application record; validation and signing failures
 * reject the request.
 *
 * WHEN TO USE
 * Use before uploading files directly to storage. Send the file contents using
 * the returned upload instructions, then include the opaque references in the
 * application request that claims the completed uploads as attachments.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import zodValidationRunner from '@shared/utils/zod-validation-runner';

import { IAppContextData } from '@app/context/types/app-context.types';
import IFileManagementAppService from '@app/file/contracts/file-management.service.contract';
import {
  IFileUploadDto,
  IFileUploadReq,
} from '@app/file/dtos/file-upload/file-upload.dto';
import { fileUploadReqValidation } from '@app/file/dtos/file-upload/file-upload.dto.validation';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  fileManagementAppService: IFileManagementAppService;
}

export default function makePreSignUploadsUsecase(deps: IDependencies) {
  return async (payload: IFileUploadReq[]): Promise<IFileUploadDto[]> => {
    zodValidationRunner(fileUploadReqValidation, payload);
    const { user } = deps.appContext.get(['user']);

    return deps.fileManagementAppService.preSignUploads({
      userId: user.id,
      files: payload,
    });
  };
}
