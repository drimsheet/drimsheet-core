import zodValidationRunner from '@shared/utils/zod-validation-runner';

import IAppContext from '@app/context/contracts/app-context.contract';
import IFileManagementAppService from '@app/file/contracts/file-management.service.contract';
import {
  IFileUploadDto,
  IFileUploadReq,
} from '@app/file/dtos/file-upload/file-upload.dto';
import { fileUploadReqValidation } from '@app/file/dtos/file-upload/file-upload.dto.validation';

interface IDependencies {
  appContext: IAppContext;
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
