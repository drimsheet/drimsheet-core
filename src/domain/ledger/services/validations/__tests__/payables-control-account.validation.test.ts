import { TEntityId } from '@shared/types/uuid';

import { LIABILITY_LEDGER_CODES } from '@domain/ledger/config/liability-codes.config';
import validation from '@domain/ledger/services/validations/payables-control-account.validation';
import { ELedgerType, ILedgerAccount } from '@domain/ledger/types/ledger.types';
import {
  ELiabilityAccountBehavior,
  ELiabilitySubType,
} from '@domain/ledger/types/liability-account.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

describe('payablesControlAccountValidation', () => {
  describe('validateStatutoryPayableSubAccount', () => {
    const accountingEntityId =
      '123e4567-e89b-42d3-a456-426614174001' as TEntityId;
    const parent = Object.freeze({
      id: '123e4567-e89b-42d3-a456-426614174002' as TEntityId,
      accountingEntityId,
      code: LIABILITY_LEDGER_CODES.PAYABLES.HEADER,
      type: ELedgerType.Liability,
      subType: ELiabilitySubType.Payable,
      behavior: ELiabilityAccountBehavior.DefaultPayable,
      isControlAccount: true,
      currency: SYSTEM_CURRENCIES.USD,
    }) as ILedgerAccount;
    it.each([
      ELiabilityAccountBehavior.DefaultPayable,
      ELiabilityAccountBehavior.TaxPayable,
    ])('accepts the permitted %s behavior', (behavior) => {
      expect(() =>
        validation.validateStatutoryPayableSubAccount(
          { ...parent, behavior },
          accountingEntityId
        )
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
      { currency: null },
    ])('rejects an invalid supplied parent: %o', (change) => {
      const invalidParent = { ...parent, ...change };
      expect(() =>
        validation.validateStatutoryPayableSubAccount(
          invalidParent,
          accountingEntityId
        )
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
  describe('validateTradePayableSubAccount', () => {
    const accountingEntityId =
      '123e4567-e89b-42d3-a456-426614174001' as TEntityId;
    const parent = Object.freeze({
      id: '123e4567-e89b-42d3-a456-426614174002' as TEntityId,
      accountingEntityId,
      code: LIABILITY_LEDGER_CODES.PAYABLES.HEADER,
      type: ELedgerType.Liability,
      subType: ELiabilitySubType.Payable,
      behavior: ELiabilityAccountBehavior.DefaultPayable,
      isControlAccount: true,
      currency: SYSTEM_CURRENCIES.USD,
    }) as ILedgerAccount;
    it.each([
      ELiabilityAccountBehavior.DefaultPayable,
      ELiabilityAccountBehavior.TradePayable,
    ])('accepts the permitted %s behavior', (behavior) => {
      expect(() =>
        validation.validateTradePayableSubAccount(
          { ...parent, behavior },
          accountingEntityId
        )
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
        validation.validateTradePayableSubAccount(
          invalidParent,
          accountingEntityId
        )
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
