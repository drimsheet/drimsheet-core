import { TEntityId } from '@shared/types/uuid';

import { EXPENSE_LEDGER_CODES } from '@domain/ledger/config/expense-codes.config';
import validation from '@domain/ledger/services/validations/tax-expense-control-account.validation';
import {
  EExpenseAccountBehavior,
  EExpenseSubType,
} from '@domain/ledger/types/expense-account.types';
import { ELedgerType, ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

describe('taxExpenseControlAccountValidation', () => {
  describe('validate', () => {
    const accountingEntityId =
      '123e4567-e89b-42d3-a456-426614174001' as TEntityId;
    const parent = Object.freeze({
      id: '123e4567-e89b-42d3-a456-426614174002' as TEntityId,
      accountingEntityId,
      code: EXPENSE_LEDGER_CODES.TAX_EXPENSE.HEADER,
      type: ELedgerType.Expense,
      subType: EExpenseSubType.IncomeTaxExpense,
      behavior: EExpenseAccountBehavior.TaxExpense,
      isControlAccount: true,
      currency: SYSTEM_CURRENCIES.USD,
    }) as ILedgerAccount;
    it.each([
      EExpenseAccountBehavior.TaxExpense,
      EExpenseAccountBehavior.Default,
    ])('accepts the permitted %s behavior', (behavior) => {
      expect(() =>
        validation.validate({ ...parent, behavior }, accountingEntityId)
      ).not.toThrow();
    });
    it.each<Partial<ILedgerAccount>>([
      {
        accountingEntityId: '123e4567-e89b-42d3-a456-426614174003' as TEntityId,
      },
      { type: ELedgerType.Asset },
      { subType: 'invalid' },
      { isControlAccount: false },
      { behavior: 'invalid' },
    ])('rejects an invalid supplied parent: %o', (change) => {
      const invalidParent = { ...parent, ...change };
      expect(() =>
        validation.validate(invalidParent, accountingEntityId)
      ).toThrow(
        expect.objectContaining({
          errorKey: 'ledger_error_asset_account_control_account_invalid',
          cause: expect.objectContaining({
            controlAccountId: parent.id,
            controlAccountLedgerCode: parent.code,
            accountingEntityId,
            controlAccountAccountingEntityId: invalidParent.accountingEntityId,
          }),
        })
      );
    });
  });
});
