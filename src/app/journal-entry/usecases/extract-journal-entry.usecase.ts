import IAppContextService from '@shared/contracts/app-context.service.contract';
import IPdfService from '@shared/contracts/pdf.service.contract';
import { EFileAttachmentType } from '@shared/values/file-attachments/types/file-attachment.types';

import { IAppContextData } from '@app/context/types/app-context.types';
import IFileStorageClient from '@app/file/contracts/file-storage-client.contract';
import { IJournalEntryExtractionDto } from '@app/journal-entry/dtos/journal-entry-extraction/journal-entry-extraction.dto';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  fileStorageClient: IFileStorageClient;
  pdfService: IPdfService;
}

export default function makeExtractJournalEntryUsecase(deps: IDependencies) {
  return async (payload: IJournalEntryExtractionDto) => {
    const downloadUrl = await deps.fileStorageClient.getDownloadUrl(
      payload.file.url
    );

    const pdfTextContent =
      payload.file.type === EFileAttachmentType.Pdf
        ? await deps.pdfService.convertToText(downloadUrl)
        : null;

    console.log('>>>>>>>>>>>>>>>>', pdfTextContent);

    return await Promise.resolve();
  };
}
