import { IFileAttachment } from '@shared/values/file-attachments/types/file-attachment.types';

export interface IJournalEntryExtractionDto {
  file: IFileAttachment;
  accountingEntityId: string;
  correlationId: string;
  delegatingActorId: string;
}
