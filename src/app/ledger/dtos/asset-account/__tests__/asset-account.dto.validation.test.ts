import {
  bankAccountCreationReqValidation,
  bankDetailsCreationReqValidation,
  pettyCashCreationReqValidation,
} from '@app/ledger/dtos/asset-account/asset-account.dto.validation';

describe('Asset Account DTO Validation', () => {
  describe('pettyCashCreationReqValidation', () => {
    it('should validate a correct petty cash creation payload with matching currency', () => {
      const payload = {
        name: 'Petty Cash USD',
        currencyCode: 'USD',
        isControlAccount: false,
        controlAccountId: '123e4567-e89b-12d3-a456-426614174003',
        openingBalance: {
          amount: {
            amount: 5000,
            currencyCode: 'USD',
            isMinorUnit: true,
          },
          exchangeRate: null,
          date: new Date('2026-07-13T18:00:00.000Z'),
        },
      };

      const result = pettyCashCreationReqValidation.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should validate correctly when openingBalance is null', () => {
      const payload = {
        name: 'Petty Cash GBP',
        currencyCode: 'GBP',
        isControlAccount: false,
        openingBalance: null,
      };

      const result = pettyCashCreationReqValidation.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should fail validation if openingBalance currency does not match account currency', () => {
      const payload = {
        name: 'Petty Cash USD',
        currencyCode: 'USD',
        isControlAccount: false,
        openingBalance: {
          amount: {
            amount: 5000,
            currencyCode: 'GBP', // mismatch!
            isMinorUnit: true,
          },
          exchangeRate: null,
          date: new Date('2026-07-13T18:00:00.000Z'),
        },
      };

      const result = pettyCashCreationReqValidation.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'ledger_error_asset_account_opening_balance_currency_mismatch_invalid'
        );
      }
    });

    it('should fail validation if name is empty', () => {
      const payload = {
        name: '',
        currencyCode: 'USD',
        isControlAccount: false,
        openingBalance: null,
      };

      const result = pettyCashCreationReqValidation.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should fail validation if name exceeds 100 characters', () => {
      const payload = {
        name: 'a'.repeat(101),
        currencyCode: 'USD',
        isControlAccount: false,
        openingBalance: null,
      };

      const result = pettyCashCreationReqValidation.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject an invalid optional control account ID', () => {
      const result = pettyCashCreationReqValidation.safeParse({
        name: 'Petty Cash USD',
        currencyCode: 'USD',
        isControlAccount: false,
        controlAccountId: 'not-a-uuid',
        openingBalance: null,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'ledger_error_ledger_account_control_account_id_invalid'
        );
      }
    });
  });

  describe('bankDetailsCreationReqValidation', () => {
    it('should validate a correct bank details DTO', () => {
      const result = bankDetailsCreationReqValidation.safeParse({
        bankName: 'First Bank of Nigeria',
        accountName: 'Company Operating Account',
        accountNumber: '0123456789',
      });
      expect(result.success).toBe(true);
    });

    it('should fail if bankName is too short', () => {
      const result = bankDetailsCreationReqValidation.safeParse({
        bankName: 'A',
        accountName: 'Company Operating Account',
        accountNumber: '0123456789',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('bankAccountCreationReqValidation', () => {
    const validPayload = {
      name: 'Operations Bank Account',
      currencyCode: 'NGN',
      bankAccount: {
        bankName: 'First Bank of Nigeria',
        accountName: 'Company Operating Account',
        accountNumber: '0123456789',
      },
      openingBalance: null,
    };

    it('should validate a valid bank account creation payload', () => {
      const result = bankAccountCreationReqValidation.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('should validate a valid optional control account ID', () => {
      const result = bankAccountCreationReqValidation.safeParse({
        ...validPayload,
        controlAccountId: '123e4567-e89b-12d3-a456-426614174003',
      });

      expect(result.success).toBe(true);
    });

    it('should reject an invalid optional control account ID', () => {
      const result = bankAccountCreationReqValidation.safeParse({
        ...validPayload,
        controlAccountId: 'not-a-uuid',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          'ledger_error_ledger_account_control_account_id_invalid'
        );
      }
    });

    it('should reject strict unknown fields at root level', () => {
      const result = bankAccountCreationReqValidation.safeParse({
        ...validPayload,
        isControlAccount: true,
      });
      expect(result.success).toBe(false);
    });

    it('should reject strict unknown fields inside bankAccount object', () => {
      const result = bankAccountCreationReqValidation.safeParse({
        ...validPayload,
        bankAccount: {
          ...validPayload.bankAccount,
          bankCode: '011',
        },
      });
      expect(result.success).toBe(false);
    });

    it('should fail validation if openingBalance currency does not match account currency', () => {
      const payload = {
        ...validPayload,
        openingBalance: {
          amount: {
            amount: 5000,
            currencyCode: 'USD', // mismatch!
            isMinorUnit: true,
          },
          exchangeRate: null,
          date: new Date('2026-07-13T18:00:00.000Z'),
        },
      };

      const result = bankAccountCreationReqValidation.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });
});

describe.each([
  {
    name: 'bank',
    schema: bankAccountCreationReqValidation,
    valid: {
      name: 'Draft Bank',
      currencyCode: 'NGN',
      bankAccount: {
        bankName: 'Test Bank',
        accountName: 'Operating Account',
        accountNumber: '0123456789',
      },
      openingBalance: null,
    },
  },
  {
    name: 'petty cash',
    schema: pettyCashCreationReqValidation,
    valid: {
      name: 'Draft Cash',
      currencyCode: 'NGN',
      isControlAccount: false,
      openingBalance: null,
    },
  },
])('$name creation status', ({ schema, valid }) => {
  it.each([undefined, 'active', 'draft'])('accepts %s', (status) => {
    expect(schema.safeParse({ ...valid, status }).success).toBe(true);
  });
  it.each(['archived', 'invalid', null])('rejects %s', (status) => {
    expect(schema.safeParse({ ...valid, status }).success).toBe(false);
  });
});
