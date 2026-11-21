import z from 'zod';

import { agentRunContextIdentifiersValidation } from '@app/ai/dtos/agent-run-context/agent-run-context.dto.validation';
import { fileAttachmentDtoValidation } from '@app/file/dtos/file-attachment/file-attachment.dto.validation';

import { IJournalEntryExtractionDto } from './journal-entry-extraction.dto';

export const journalEntryExtractionDtoValidation =
  agentRunContextIdentifiersValidation.extend({
    file: fileAttachmentDtoValidation,
  }) satisfies z.ZodType<IJournalEntryExtractionDto>;
