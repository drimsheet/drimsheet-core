import z from 'zod';

import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import journalLineError from '@domain/journal-entry/errors/journal-line.error';

export const journalEntryMetaUpdateReqValidation = z
  .object({
    header: z
      .object({
        memo: z
          .string(new journalEntryError.InvalidMemo().errorKey)
          .nullable()
          .optional(),
      })
      .strict()
      .optional(),
    lines: z
      .array(
        z
          .object({
            id: z.uuid(new journalEntryError.RectificationLineId().errorKey),
            description: z
              .string(new journalLineError.InvalidDescription().errorKey)
              .nullable()
              .optional(),
          })
          .strict()
      )
      .optional(),
  })
  .strict();
