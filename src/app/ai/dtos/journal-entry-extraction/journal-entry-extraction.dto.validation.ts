import z from 'zod';

import accountingError from '@domain/accounting/errors/accounting.error';
import actorError from '@domain/user/errors/actor.error';

import agentContextAppError from '@app/ai/errors/agent-context.error';
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
    context: z.strictObject({
      accountingEntityId: z.uuid(
        new accountingError.InvalidAccountingEntityId().errorKey
      ),
      correlationId: z.uuid(
        new agentContextAppError.InvalidCorrelationId().errorKey
      ),
      delegatingActorId: z.uuid(new actorError.InvalidId().errorKey),
    }),
  }) satisfies z.ZodType<IJournalEntryExtractionDto>;
