import { TEntityId } from '@shared/types/uuid';

import {
  ELedgerAccountStatus,
  ILedgerAccount,
} from '@domain/ledger/types/ledger.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';

import ledgerAccountMapper from '@app/ledger/dtos/ledger-account/ledger-account.dto.mapper';

describe('Ledger Account DTO Mapper', () => {
  describe('toDto', () => {
    it('should map ledger account and balances to DTO correctly', () => {
      const balance = moneyValue.make(5000n, SYSTEM_CURRENCIES.GBP, true);
      const functionalBalance = moneyValue.make(
        5000n,
        SYSTEM_CURRENCIES.GBP,
        true
      );

      const mockAccount: ILedgerAccount = {
        id: 'acc-id-123' as unknown as TEntityId,
        version: 1,
        code: '1000',
        materializedPath: '1000',
        accountingEntityId: 'entity-id-456' as unknown as TEntityId,
        type: 'asset',
        normalBalance: 'debit',
        subType: 'cash',
        behavior: 'regular',
        isControlAccount: false,
        controlAccountId: null,
        name: 'Main Cash Account',
        currency: SYSTEM_CURRENCIES.GBP,
        status: 'active',
        contraAccountRule: 'contra_permitted',
        adjunctAccountRule: 'adjunct_permitted',
        meta: null,
        openingBalanceDate: null,
        createdBy: 'user-id-789' as unknown as TEntityId,
        createdAt: new Date('2026-07-13T18:00:00Z'),
        updatedAt: new Date('2026-07-13T18:00:00Z'),
        deletedAt: null,
      };

      const dto = ledgerAccountMapper.toDto(
        mockAccount,
        balance,
        functionalBalance
      );

      expect(dto).toEqual({
        version: mockAccount.version,
        id: 'acc-id-123',
        code: '1000',
        materializedPath: '1000',
        accountingEntityId: 'entity-id-456',
        type: 'asset',
        normalBalance: 'debit',
        subType: 'cash',
        behavior: 'regular',
        isControlAccount: false,
        controlAccountId: undefined,
        name: 'Main Cash Account',
        status: 'active',
        contraAccountRule: 'contra_permitted',
        adjunctAccountRule: 'adjunct_permitted',
        openingBalanceDate: null,
        createdBy: 'user-id-789',
        createdAt: new Date('2026-07-13T18:00:00Z'),
        updatedAt: new Date('2026-07-13T18:00:00Z'),
        deletedAt: undefined,
        balance: {
          amount: 5000,
          currencyCode: 'GBP',
          isMinorUnit: true,
        },
        functionalBalance: {
          amount: 5000,
          currencyCode: 'GBP',
          isMinorUnit: true,
        },
      });
    });

    it.each([
      ELedgerAccountStatus.Active,
      ELedgerAccountStatus.Archived,
      ELedgerAccountStatus.Draft,
    ])('maps a %s subaccount with its parent and deletion date', (status) => {
      const balance = moneyValue.make(0n, SYSTEM_CURRENCIES.GBP, true);
      const functionalBalance = moneyValue.make(
        0n,
        SYSTEM_CURRENCIES.GBP,
        true
      );

      const mockAccount: ILedgerAccount = {
        id: 'acc-id-123' as unknown as TEntityId,
        version: 1,
        code: '1000',
        materializedPath: '1000',
        accountingEntityId: 'entity-id-456' as unknown as TEntityId,
        type: 'asset',
        normalBalance: 'debit',
        subType: 'cash',
        behavior: 'regular',
        isControlAccount: false,
        controlAccountId: 'parent-id-999' as unknown as TEntityId,
        name: 'Main Cash Account',
        currency: SYSTEM_CURRENCIES.GBP,
        status,
        contraAccountRule: 'contra_permitted',
        adjunctAccountRule: 'adjunct_permitted',
        meta: null,
        openingBalanceDate: null,
        createdBy: 'user-id-789' as unknown as TEntityId,
        createdAt: new Date('2026-07-13T18:00:00Z'),
        updatedAt: new Date('2026-07-13T18:00:00Z'),
        deletedAt: new Date('2026-07-13T19:00:00Z'),
      };

      const dto = ledgerAccountMapper.toDto(
        mockAccount,
        balance,
        functionalBalance
      );

      expect(dto.controlAccountId).toBe('parent-id-999');
      expect(dto.status).toBe(status);
      expect(dto.deletedAt).toEqual(new Date('2026-07-13T19:00:00Z'));
    });
  });
});
