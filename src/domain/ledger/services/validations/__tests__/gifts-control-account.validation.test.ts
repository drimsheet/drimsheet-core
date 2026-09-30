import { TEntityId } from '@shared/types/uuid';

import { REVENUE_LEDGER_CODES } from '@domain/ledger/config/revenue-codes.config';
import validation from '@domain/ledger/services/validations/gifts-control-account.validation';
import { ELedgerType, ILedgerAccount } from '@domain/ledger/types/ledger.types';
import {
  ERevenueAccountBehavior,
  ERevenueSubType,
} from '@domain/ledger/types/revenue-account.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

describe('giftsControlAccountValidation', () => {
  describe('validate', () => {
    const accountingEntityId =
      '123e4567-e89b-42d3-a456-426614174001' as TEntityId;
    const parent = Object.freeze({
      id: '123e4567-e89b-42d3-a456-426614174002' as TEntityId,
      accountingEntityId,
      code: REVENUE_LEDGER_CODES.GIFTS.HEADER,
      type: ELedgerType.Revenue,
      subType: ERevenueSubType.Gifts,
      behavior: ERevenueAccountBehavior.Gifts,
      isControlAccount: true,
      currency: SYSTEM_CURRENCIES.USD,
    }) as ILedgerAccount;
    it.each([ERevenueAccountBehavior.Gifts])(
      'accepts the permitted %s behavior',
      (behavior) => {
        expect(() =>
          validation.validate({ ...parent, behavior }, accountingEntityId)
        ).not.toThrow();
      }
    );
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
