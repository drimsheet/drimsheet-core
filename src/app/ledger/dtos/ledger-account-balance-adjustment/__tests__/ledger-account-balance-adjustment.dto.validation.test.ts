import { ledgerAccountBalanceAdjustmentDtoSchema } from '@app/ledger/dtos/ledger-account-balance-adjustment/ledger-account-balance-adjustment.dto.validation';

describe('Ledger Account Balance Adjustment DTO Validation', () => {
  it('should validate a correct balance adjustment DTO payload', () => {
    const payload = {
      journalEntryId: '2b4c1064-a09e-4e4f-b6a3-23945cc87f74',
    };

    const result = ledgerAccountBalanceAdjustmentDtoSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('should fail if the journal entry ID is not a UUID', () => {
    const payload = {
      journalEntryId: 'invalid-uuid',
    };

    const result = ledgerAccountBalanceAdjustmentDtoSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});
