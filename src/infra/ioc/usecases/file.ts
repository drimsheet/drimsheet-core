import makePreSignUploadsUsecase from '@app/file/usecases/pre-sign-uploads.usecase';

import { fileManagementAppService } from '@infra/ioc/services/file';
import { makeTracedUseCase } from '@infra/observability/usecase-tracing';
import appContext from '@infra/runtime/app-context';

export const preSignUploadsUseCase = makeTracedUseCase(
  'file.preSignUploadsUseCase',
  makePreSignUploadsUsecase({ appContext, fileManagementAppService })
);
