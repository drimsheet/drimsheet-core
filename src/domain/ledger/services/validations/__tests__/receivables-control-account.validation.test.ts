import { TEntityId } from '@shared/types/uuid';

import { ASSET_LEDGER_CODES } from '@domain/ledger/config/asset-codes.config';
import validation from '@domain/ledger/services/validations/receivables-control-account.validation';
import {
  EAssetAccountBehavior,
  EAssetSubType,
} from '@domain/ledger/types/asset-account.types';
import { ELedgerType, ILedgerAccount } from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

describe('receivablesControlAccountValidation', () => {
  describe('validateStatutoryReceivableSubAccount', () => {
    const accountingEntityId =
      '123e4567-e89b-42d3-a456-426614174001' as TEntityId;
    const parent = Object.freeze({
      id: '123e4567-e89b-42d3-a456-426614174002' as TEntityId,
      accountingEntityId,
      code: ASSET_LEDGER_CODES.RECEIVABLES.HEADER,
      type: ELedgerType.Asset,
      subType: EAssetSubType.Receivables,
      behavior: EAssetAccountBehavior.DefaultReceivables,
      isControlAccount: true,
      currency: SYSTEM_CURRENCIES.USD,
    }) as ILedgerAccount;
    it.each([
      EAssetAccountBehavior.DefaultReceivables,
      EAssetAccountBehavior.StatutoryReceivable,
    ])('accepts the permitted %s behavior', (behavior) => {
      expect(() =>
        validation.validateStatutoryReceivableSubAccount(
          { ...parent, behavior },
          accountingEntityId
        )
      ).not.toThrow();
    });
    it.each<Partial<ILedgerAccount>>([
      {
        accountingEntityId: '123e4567-e89b-42d3-a456-426614174003' as TEntityId,
      },
      { type: ELedgerType.Liability },
      { subType: 'invalid' },
      { isControlAccount: false },
      { behavior: 'invalid' },
    ])('rejects an invalid supplied parent: %o', (change) => {
      const invalidParent = { ...parent, ...change };
      expect(() =>
        validation.validateStatutoryReceivableSubAccount(
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
  describe('validateTradeReceivableSubAccount', () => {
    const accountingEntityId =
      '123e4567-e89b-42d3-a456-426614174001' as TEntityId;
    const parent = Object.freeze({
      id: '123e4567-e89b-42d3-a456-426614174002' as TEntityId,
      accountingEntityId,
      code: ASSET_LEDGER_CODES.RECEIVABLES.HEADER,
      type: ELedgerType.Asset,
      subType: EAssetSubType.Receivables,
      behavior: EAssetAccountBehavior.DefaultReceivables,
      isControlAccount: true,
      currency: SYSTEM_CURRENCIES.USD,
    }) as ILedgerAccount;
    it.each([
      EAssetAccountBehavior.DefaultReceivables,
      EAssetAccountBehavior.TradeReceivable,
    ])('accepts the permitted %s behavior', (behavior) => {
      expect(() =>
        validation.validateTradeReceivableSubAccount(
          { ...parent, behavior },
          accountingEntityId
        )
      ).not.toThrow();
    });
    it.each<Partial<ILedgerAccount>>([
      {
        accountingEntityId: '123e4567-e89b-42d3-a456-426614174003' as TEntityId,
      },
      { type: ELedgerType.Liability },
      { subType: 'invalid' },
      { isControlAccount: false },
      { behavior: 'invalid' },
    ])('rejects an invalid supplied parent: %o', (change) => {
      const invalidParent = { ...parent, ...change };
      expect(() =>
        validation.validateTradeReceivableSubAccount(
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
