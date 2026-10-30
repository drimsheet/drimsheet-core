import { ELedgerAccountBehavior } from '@domain/ledger/types/account-behaviors.tyypes';
import { ELedgerAccountSubType } from '@domain/ledger/types/ledger-aggregate.types';
import { ELedgerType } from '@domain/ledger/types/ledger.types';

import { ELedgerAccountSortBy } from '@app/ledger/contracts/ledger-account.query.repo.contract';
import {
  bankAccountCreationReqValidation,
  pettyCashCreationReqValidation,
} from '@app/ledger/dtos/asset-account/asset-account.dto.validation';
import { createExpenseAccountValidation } from '@app/ledger/dtos/expense-account/expense-account.dto.validation';
import {
  getLedgerAccountQueryValidationSchema,
  ledgerAccountBehaviorValidation,
  ledgerAccountOrderByValidationSchema,
  ledgerAccountPromotionNamesValidation,
  ledgerAccountSubTypeValidation,
  ledgerAccountTypeValidation,
} from '@app/ledger/dtos/ledger-account/ledger-account.dto.validation';
import {
  createStatutoryPayableAccountValidation,
  createTradePayableAccountValidation,
} from '@app/ledger/dtos/payable-account/payable-account.dto.validation';
import {
  createStatutoryReceivableAccountValidation,
  createTradeReceivableAccountValidation,
} from '@app/ledger/dtos/receivable-account/receivable-account.dto.validation';
import { createRevenueAccountValidation } from '@app/ledger/dtos/revenue-account/revenue-account.dto.validation';

describe('Ledger Account DTO Validation', () => {
  describe('ledgerAccountTypeValidation', () => {
    it('should validate valid ledger account types', () => {
      expect(
        ledgerAccountTypeValidation.safeParse(ELedgerType.Asset).success
      ).toBe(true);
      expect(
        ledgerAccountTypeValidation.safeParse(ELedgerType.Liability).success
      ).toBe(true);
    });

    it('should fail on invalid ledger account type', () => {
      expect(
        ledgerAccountTypeValidation.safeParse('invalid_type').success
      ).toBe(false);
    });
  });

  describe('ledgerAccountOrderByValidationSchema', () => {
    it('should validate valid order by options', () => {
      expect(
        ledgerAccountOrderByValidationSchema.safeParse(
          ELedgerAccountSortBy.AccountName
        ).success
      ).toBe(true);
      expect(
        ledgerAccountOrderByValidationSchema.safeParse(
          ELedgerAccountSortBy.CreatedAt
        ).success
      ).toBe(true);
    });

    it('should fail on invalid order by options', () => {
      expect(
        ledgerAccountOrderByValidationSchema.safeParse('invalid_order_by')
          .success
      ).toBe(false);
    });
  });

  describe('ledgerAccountSubTypeValidation', () => {
    it('should validate valid sub-types', () => {
      expect(
        ledgerAccountSubTypeValidation.safeParse(
          ELedgerAccountSubType.CashAndCashEquivalent
        ).success
      ).toBe(true);
      expect(
        ledgerAccountSubTypeValidation.safeParse(
          ELedgerAccountSubType.Receivables
        ).success
      ).toBe(true);
    });

    it('should fail on invalid sub-types', () => {
      expect(
        ledgerAccountSubTypeValidation.safeParse('invalid_sub_type').success
      ).toBe(false);
    });
  });

  describe('ledgerAccountBehaviorValidation', () => {
    it('should validate valid behaviors', () => {
      expect(
        ledgerAccountBehaviorValidation.safeParse(ELedgerAccountBehavior.Bank)
          .success
      ).toBe(true);
      expect(
        ledgerAccountBehaviorValidation.safeParse(
          ELedgerAccountBehavior.Default
        ).success
      ).toBe(true);
    });

    it('should fail on invalid behaviors', () => {
      expect(
        ledgerAccountBehaviorValidation.safeParse('invalid_behavior').success
      ).toBe(false);
    });
  });

  describe('getLedgerAccountQueryValidationSchema', () => {
    it('should validate correct queries', () => {
      const payload = {
        limit: 20,
        page: 1,
        statuses: ['active', 'draft', 'archived'],
        types: [ELedgerType.Asset, ELedgerType.Liability],
        subTypes: [
          ELedgerAccountSubType.CashAndCashEquivalent,
          ELedgerAccountSubType.Receivables,
        ],
        behavior: ELedgerAccountBehavior.Bank,
        isControlAccount: true,
        orderBy: ELedgerAccountSortBy.AccountName,
      };
      expect(
        getLedgerAccountQueryValidationSchema.safeParse(payload).success
      ).toBe(true);
    });

    it('should validate with optional fields omitted', () => {
      const payload = {
        limit: 10,
        page: 2,
      };
      expect(
        getLedgerAccountQueryValidationSchema.safeParse(payload).success
      ).toBe(true);
    });

    it('accepts empty filter arrays', () => {
      expect(
        getLedgerAccountQueryValidationSchema.safeParse({
          types: [],
          subTypes: [],
          statuses: [],
        }).success
      ).toBe(true);
    });

    it.each([
      { statuses: 'active' },
      { statuses: ['active', 'invalid_status'] },
      { types: 'asset' },
      { subTypes: 'cash_and_cash_equivalent' },
      { types: ['asset', 'invalid_type'] },
      { subTypes: ['cash_and_cash_equivalent', 'invalid_sub_type'] },
    ])('rejects invalid array filters: %j', (payload) => {
      expect(
        getLedgerAccountQueryValidationSchema.safeParse(payload).success
      ).toBe(false);
    });

    it('should fail if fields have invalid types', () => {
      const payload = {
        limit: 'ten', // should be number
      };
      expect(
        getLedgerAccountQueryValidationSchema.safeParse(payload).success
      ).toBe(false);
    });
  });
});

describe('optional creation promotion names', () => {
  const names = {
    newControlAccountName: 'إيرادات الاستشارات',
    newPostingAccountName: 'Conseil (par défaut)',
  };
  const basic = { name: 'New account', isControlAccount: false };
  const schemas = [
    {
      name: 'revenue',
      schema: createRevenueAccountValidation,
      payload: { ...basic, behavior: 'services' },
    },
    {
      name: 'expense',
      schema: createExpenseAccountValidation,
      payload: { ...basic, behavior: 'bank_charge' },
    },
    {
      name: 'trade receivable',
      schema: createTradeReceivableAccountValidation,
      payload: { ...basic, currencyCode: 'NGN' },
    },
    {
      name: 'statutory receivable',
      schema: createStatutoryReceivableAccountValidation,
      payload: { ...basic, currencyCode: 'NGN' },
    },
    {
      name: 'trade payable',
      schema: createTradePayableAccountValidation,
      payload: basic,
    },
    {
      name: 'statutory payable',
      schema: createStatutoryPayableAccountValidation,
      payload: { ...basic, currencyCode: 'NGN' },
    },
    {
      name: 'petty cash',
      schema: pettyCashCreationReqValidation,
      payload: { ...basic, currencyCode: 'NGN', openingBalance: null },
    },
    {
      name: 'bank',
      schema: bankAccountCreationReqValidation,
      payload: {
        name: 'New bank',
        currencyCode: 'NGN',
        openingBalance: null,
        bankAccount: {
          bankName: 'Test Bank',
          accountName: 'Current Account',
          accountNumber: '1234567890',
        },
      },
    },
  ];

  it.each(schemas)(
    'accepts omitted or localized names for $name',
    ({ schema, payload }) => {
      expect(schema.safeParse(payload).success).toBe(true);
      expect(schema.parse({ ...payload, promotionNames: names })).toMatchObject(
        { promotionNames: names }
      );
    }
  );

  it.each(schemas)(
    'rejects incomplete promotion names for $name',
    ({ schema, payload }) => {
      expect(
        schema.safeParse({
          ...payload,
          promotionNames: {
            newControlAccountName: names.newControlAccountName,
          },
        }).success
      ).toBe(false);
    }
  );

  it.each(['newControlAccountName', 'newPostingAccountName'])(
    'validates the %s field with the account-name error key',
    (field) => {
      for (const invalidName of [
        undefined,
        null,
        123,
        '',
        'x',
        'x'.repeat(101),
      ]) {
        const parsed = ledgerAccountPromotionNamesValidation.safeParse({
          ...names,
          [field]: invalidName,
        });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
          expect(parsed.error.issues).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                path: [field],
                message: 'ledger_error_ledger_account_name_invalid',
              }),
            ])
          );
        }
      }
    }
  );

  it('rejects unknown promotion fields', () => {
    expect(
      ledgerAccountPromotionNamesValidation.safeParse({
        ...names,
        unexpected: true,
      }).success
    ).toBe(false);
  });
});
