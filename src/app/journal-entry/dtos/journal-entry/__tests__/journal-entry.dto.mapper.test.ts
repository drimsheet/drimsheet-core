import { TEntityId } from '@shared/types/uuid';

import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
  IJournalEntry,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import { EExchangeRateType } from '@domain/money/types/exchange-rate.types';
import moneyValue from '@domain/money/values/money.vo';

import { IJournalEntryDetails } from '@app/journal-entry/contracts/journal-entry.query.repo.contract';
import journalEntryDtoMapper from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.mapper';

describe('Journal Entry DTO Mapper', () => {
  describe('toDto', () => {
    it('maps a journal entry, its attachments, and its lines to a DTO', () => {
      const effectiveDate = new Date('2026-08-01T00:00:00.000Z');
      const postedAt = new Date('2026-08-01T12:00:00.000Z');
      const createdAt = new Date('2026-08-01T10:00:00.000Z');
      const updatedAt = new Date('2026-08-01T12:00:00.000Z');
      const exchangeRateAsOf = new Date('2026-08-01T09:00:00.000Z');
      const exchangeRateCreatedAt = new Date('2026-08-01T09:05:00.000Z');

      const entry: IJournalEntry = {
        id: 'entry-id' as unknown as TEntityId,
        accountingEntityId: 'accounting-entity-id' as unknown as TEntityId,
        sourceType: EJournalEntrySourceType.Transfer,
        memo: 'Move funds to savings',
        status: EJournalEntryStatus.Posted,
        effectiveDate,
        postedAt,
        voidedAt: null,
        voidingEntryId: null,
        version: 2,
        createdBy: 'user-id' as unknown as TEntityId,
        createdAt,
        updatedAt,
        attachments: [
          {
            url: 'https://files.example.com/transfer.pdf',
            name: 'transfer.pdf',
            type: 'application/pdf',
            size: 2_048,
          },
        ],
        lines: [
          {
            createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
            id: 'line-id' as unknown as TEntityId,
            entryId: 'entry-id' as unknown as TEntityId,
            accountId: 'account-id' as unknown as TEntityId,
            counterpartyId: null,
            sequenceOrder: 1,
            amount: moneyValue.make(10_000n, SYSTEM_CURRENCIES.USD, true),
            exchangeRate: {
              currencyPair: 'USD/GBP',
              baseCurrencyCode: 'USD',
              targetCurrencyCode: 'GBP',
              rate: 0.75,
              type: EExchangeRateType.Market,
              asOf: exchangeRateAsOf,
              source: 'test-rate-provider',
              createdAt: exchangeRateCreatedAt,
            },
            functionalAmount: moneyValue.make(
              7_500n,
              SYSTEM_CURRENCIES.GBP,
              true
            ),
            side: EJournalSide.Debit,
            description: 'Savings transfer',
            meta: { internalReference: 'not-exposed' },
            version: 1,
            createdAt,
            updatedAt,
          },
        ],
      };

      expect(journalEntryDtoMapper.toDto(entry)).toEqual({
        id: 'entry-id',
        accountingEntityId: 'accounting-entity-id',
        sourceType: 'transfer',
        memo: 'Move funds to savings',
        status: 'posted',
        effectiveDate,
        postedAt,
        voidedAt: null,
        voidingEntryId: null,
        version: 2,
        createdBy: 'user-id',
        createdAt,
        updatedAt,
        attachments: [
          {
            url: 'https://files.example.com/transfer.pdf',
            name: 'transfer.pdf',
            type: 'application/pdf',
            size: 2_048,
          },
        ],
        lines: [
          {
            createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
            id: 'line-id',
            entryId: 'entry-id',
            accountId: 'account-id',
            counterpartyId: null,
            sequenceOrder: 1,
            amount: {
              amount: 10_000,
              currencyCode: 'USD',
              isMinorUnit: true,
            },
            exchangeRate: {
              currencyPair: 'USD/GBP',
              baseCurrencyCode: 'USD',
              targetCurrencyCode: 'GBP',
              rate: 0.75,
              type: 'market',
              asOf: exchangeRateAsOf,
              source: 'test-rate-provider',
              createdAt: exchangeRateCreatedAt,
            },
            functionalAmount: {
              amount: 7_500,
              currencyCode: 'GBP',
              isMinorUnit: true,
            },
            side: 'debit',
            description: 'Savings transfer',
            version: 1,
            createdAt,
            updatedAt,
          },
        ],
      });
    });
  });

  describe('toListDto', () => {
    it('maps account and optional counterparty details without flat relationship IDs', () => {
      const effectiveDate = new Date('2026-08-01T00:00:00.000Z');
      const createdAt = new Date('2026-08-01T10:00:00.000Z');
      const updatedAt = new Date('2026-08-01T12:00:00.000Z');
      const entryId = 'entry-id' as unknown as TEntityId;
      const accountId = 'account-id' as unknown as TEntityId;
      const counterpartyId = 'counterparty-id' as unknown as TEntityId;
      const amount = moneyValue.make(10_000n, SYSTEM_CURRENCIES.USD, true);

      const entry: IJournalEntryDetails = {
        id: entryId,
        accountingEntityId: 'accounting-entity-id' as unknown as TEntityId,
        sourceType: EJournalEntrySourceType.Receipt,
        memo: 'Customer receipt',
        status: EJournalEntryStatus.Posted,
        effectiveDate,
        postedAt: createdAt,
        voidedAt: null,
        voidingEntryId: null,
        version: 1,
        createdBy: 'user-id' as unknown as TEntityId,
        createdAt,
        updatedAt,
        attachments: [
          {
            url: 'https://files.example.com/receipt.pdf',
            name: 'receipt.pdf',
            type: 'application/pdf',
            size: 2_048,
          },
        ],
        lines: [
          {
            createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
            id: 'line-id-1' as unknown as TEntityId,
            entryId,
            accountId,
            counterpartyId,
            account: { id: accountId, name: 'Cash' },
            counterparty: {
              status: 'active' as const,
              id: counterpartyId,
              name: 'Acme Ltd',
            },
            sequenceOrder: 1,
            amount,
            exchangeRate: null,
            functionalAmount: amount,
            side: EJournalSide.Debit,
            description: 'Cash received',
            meta: { internalReference: 'not-exposed' },
            version: 1,
            createdAt,
            updatedAt,
          },
          {
            createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
            id: 'line-id-2' as unknown as TEntityId,
            entryId,
            accountId,
            counterpartyId: null,
            account: { id: accountId, name: 'Sales' },
            counterparty: null,
            sequenceOrder: 2,
            amount,
            exchangeRate: null,
            functionalAmount: amount,
            side: EJournalSide.Credit,
            description: null,
            meta: null,
            version: 1,
            createdAt,
            updatedAt,
          },
        ],
      };

      const result = journalEntryDtoMapper.toListDto(entry);

      expect(result).toEqual({
        id: entryId,
        accountingEntityId: entry.accountingEntityId,
        sourceType: EJournalEntrySourceType.Receipt,
        memo: 'Customer receipt',
        status: EJournalEntryStatus.Posted,
        effectiveDate,
        postedAt: createdAt,
        voidedAt: null,
        voidingEntryId: null,
        version: 1,
        createdBy: entry.createdBy,
        createdAt,
        updatedAt,
        attachments: entry.attachments,
        lines: [
          {
            createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
            id: 'line-id-1',
            entryId,
            account: { id: accountId, name: 'Cash' },
            counterparty: {
              status: 'active' as const,
              id: counterpartyId,
              name: 'Acme Ltd',
            },
            sequenceOrder: 1,
            amount: {
              amount: 10_000,
              currencyCode: SYSTEM_CURRENCIES.USD.code,
              isMinorUnit: true,
            },
            exchangeRate: null,
            functionalAmount: {
              amount: 10_000,
              currencyCode: SYSTEM_CURRENCIES.USD.code,
              isMinorUnit: true,
            },
            side: EJournalSide.Debit,
            description: 'Cash received',
            version: 1,
            createdAt,
            updatedAt,
          },
          {
            createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
            id: 'line-id-2',
            entryId,
            account: { id: accountId, name: 'Sales' },
            counterparty: null,
            sequenceOrder: 2,
            amount: {
              amount: 10_000,
              currencyCode: SYSTEM_CURRENCIES.USD.code,
              isMinorUnit: true,
            },
            exchangeRate: null,
            functionalAmount: {
              amount: 10_000,
              currencyCode: SYSTEM_CURRENCIES.USD.code,
              isMinorUnit: true,
            },
            side: EJournalSide.Credit,
            description: null,
            version: 1,
            createdAt,
            updatedAt,
          },
        ],
      });
      expect(result.lines[0]).not.toHaveProperty('accountId');
      expect(result.lines[0]).not.toHaveProperty('counterpartyId');
      expect(result.lines[0]).not.toHaveProperty('meta');
    });
  });
});
