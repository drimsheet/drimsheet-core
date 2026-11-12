import makeFileManagementAppService from '@app/file/services/file-management.service';

import vars from '@infra/config/vars.config';
import makeBlackblazeClient from '@infra/integrations/blackblaze/blackblaze-client';
import makePdfService from '@infra/services/pdf.service';

export const fileStorageClient = makeBlackblazeClient({
  appKeyId: vars.B2_APP_KEY_ID,
  appKey: vars.B2_APP_KEY,
  bucketName: vars.B2_BUCKET_NAME,
  endpoint: vars.B2_S3_ENDPOINT,
  region: vars.B2_REGION,
});

export const fileManagementAppService = makeFileManagementAppService({
  fileStorageClient,
});

export const pdfService = makePdfService();
