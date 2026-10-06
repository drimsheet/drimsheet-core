import { TEntityId } from '@shared/types/uuid';

import { IAccountTransaction } from '@domain/journal-entry/types/account-transaction.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';

import accountTransactionMapper from '@app/ledger/dtos/account-transaction/account-transaction.dto.mapper';

describe('Account Transaction DTO Mapper', () => {
  describe('toDto', () => {
    it('should map account transaction to DTO correctly', () => {
      const moneyAmount = moneyValue.make(1000n, SYSTEM_CURRENCIES.USD, true);
      const functionalAmount = moneyValue.make(
        1000n,
        SYSTEM_CURRENCIES.USD,
        true
      );

      const mockTransaction: IAccountTransaction = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: 'tx-id-123' as unknown as TEntityId,
        entryId: 'entry-id-456' as unknown as TEntityId,
        accountId: 'account-id-789' as unknown as TEntityId,
        counterpartyId: 'counterparty-id-111' as unknown as TEntityId,
        sequenceOrder: 1,
        amount: moneyAmount,
        exchangeRate: null,
        functionalAmount: functionalAmount,
        side: 'debit',
        description: 'Test description',
        meta: null,
        version: 1,
        createdAt: new Date('2026-07-13T18:00:00Z'),
        updatedAt: new Date('2026-07-13T18:00:00Z'),
        header: {
          sourceType: 'transfer',
          memo: 'Test memo',
          status: 'posted',
          effectiveDate: new Date('2026-07-13T18:00:00Z'),
          postedAt: new Date('2026-07-13T18:00:00Z'),
          voidedAt: null,
          voidingEntryId: null,
          version: 1,
          createdBy: 'user-id-555' as unknown as TEntityId,
          createdAt: new Date('2026-07-13T18:00:00Z'),
          updatedAt: new Date('2026-07-13T18:00:00Z'),
        },
      };

      const dto = accountTransactionMapper.toDto(mockTransaction);

      expect(dto).toEqual({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: 'tx-id-123',
        entryId: 'entry-id-456',
        accountId: 'account-id-789',
        counterpartyId: 'counterparty-id-111',
        sequenceOrder: 1,
        amount: {
          amount: 1000,
          currencyCode: 'USD',
          isMinorUnit: true,
        },
        exchangeRate: null,
        functionalAmount: {
          amount: 1000,
          currencyCode: 'USD',
          isMinorUnit: true,
        },
        side: 'debit',
        description: 'Test description',
        createdAt: new Date('2026-07-13T18:00:00Z'),
        updatedAt: new Date('2026-07-13T18:00:00Z'),
        header: {
          sourceType: 'transfer',
          memo: 'Test memo',
          status: 'posted',
          effectiveDate: new Date('2026-07-13T18:00:00Z'),
          postedAt: new Date('2026-07-13T18:00:00Z'),
          voidedAt: null,
          voidingEntryId: null,
          createdBy: 'user-id-555',
          createdAt: new Date('2026-07-13T18:00:00Z'),
          updatedAt: new Date('2026-07-13T18:00:00Z'),
        },
      });
      expect(dto).not.toHaveProperty('version');
      expect(dto.header).not.toHaveProperty('version');
    });
  });
});
