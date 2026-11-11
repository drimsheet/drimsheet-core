import IAppContextService from '@shared/contracts/app-context.service.contract';
import IPdfService from '@shared/contracts/pdf.service.contract';
import { EFileAttachmentType } from '@shared/values/file-attachments/types/file-attachment.types';

import { IAppContextData } from '@app/context/types/app-context.types';
import { IJournalEntryExtractionDto } from '@app/journal-entry/dtos/journal-entry-extraction/journal-entry-extraction.dto';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  pdfService: IPdfService;
}

function makeExtractJournalEntryUsecase(deps: IDependencies) {
  return async (payload: IJournalEntryExtractionDto) => {
    const { actor, accountingEntity, correlationId } = deps.appContext.get([
      'actor',
      'accountingEntity',
    ]);

    const pdfTextContent =
      payload.file.type === EFileAttachmentType.Pdf
        ? deps.pdfService.convertToText(payload.file.url)
        : null;

    console.log('>>>>>>>>>>>>>>>>', pdfTextContent);

    return await Promise.resolve();
  };
}
