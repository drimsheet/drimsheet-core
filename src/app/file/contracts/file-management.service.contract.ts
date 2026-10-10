import { TEntityId } from '@shared/types/uuid';
import { IFileAttachment } from '@shared/values/file-attachments/types/file-attachment.types';

import {
  IFileUploadDto,
  IFileUploadReq,
} from '@app/file/dtos/file-upload/file-upload.dto';
import { UFileUploadPurpose } from '@app/file/types/file.types';

interface IPreSignManagedFileUploadsPayload {
  userId: TEntityId;
  files: IFileUploadReq[];
}

export interface IClaimManagedFileUploadsPayload {
  userId: TEntityId;
  purpose: UFileUploadPurpose;

  /**
   * Opaque upload handles returned by file upload preparation. The service
   * derives storage keys from these handles, the authenticated user, and purpose.
   */
  references: string[];
}

export default interface IFileManagementAppService {
  preSignUploads(
    payload: IPreSignManagedFileUploadsPayload
  ): Promise<IFileUploadDto[]>;

  claimUploads(
    payload: IClaimManagedFileUploadsPayload
  ): Promise<IFileAttachment[]>;
}
