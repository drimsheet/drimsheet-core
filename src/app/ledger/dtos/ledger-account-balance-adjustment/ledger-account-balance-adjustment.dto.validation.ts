import z from 'zod';

export const ledgerAccountBalanceAdjustmentDtoSchema = z.object({
  journalEntryId: z.uuid(),
});
