import z from 'zod';

import { agentRunContextDtoValidation } from '@app/ai/dtos/agent-run-context/agent-run-context.dto.validation';
import { fileAttachmentDtoValidation } from '@app/file/dtos/file-attachment/file-attachment.dto.validation';

import {
  IJournalEntriesExtractionInput,
  IJournalEntryExtractionDto,
} from './journal-entry-extraction.dto';

export const journalEntriesExtractionInputValidation = z.strictObject({
  value: fileAttachmentDtoValidation.or(z.string()),
}) satisfies z.ZodType<IJournalEntriesExtractionInput>;

export const journalEntryExtractionDtoValidation =
  journalEntriesExtractionInputValidation.extend({
    context: agentRunContextDtoValidation,
  }) satisfies z.ZodType<IJournalEntryExtractionDto>;
