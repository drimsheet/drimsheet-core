import { TEntityId } from '@shared/types/uuid';

import { IAccountTransaction } from '@domain/journal-entry/types/account-transaction.types';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';

import { IJournalEntryModel } from '@infra/persistence/repos/journal-entry/mappers/journal-entry.mapper';
import { IJournalLineModel } from '@infra/persistence/repos/journal-entry/mappers/journal-line.mapper';
import accountTransactionMapper from '@infra/persistence/repos/ledger/mappers/account-transaction.mapper';

describe('Account Transaction Mapper', () => {
  const id = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const entryId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const accountId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
  const counterpartyId = '123e4567-e89b-12d3-a456-426614174004' as TEntityId;
  const createdBy = '123e4567-e89b-12d3-a456-426614174005' as TEntityId;
  const createdAt = new Date('2026-05-01T00:00:00.000Z');
  const updatedAt = new Date('2026-05-01T01:00:00.000Z');
  const effectiveDate = new Date('2026-04-30T00:00:00.000Z');
  const postedAt = new Date('2026-05-01T02:00:00.000Z');
  const voidedAt = new Date('2026-05-01T03:00:00.000Z');

  const transaction: IAccountTransaction = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id,
    entryId,
    accountId,
    counterpartyId,
    sequenceOrder: 1,
    amount: moneyValue.make(100_00, SYSTEM_CURRENCIES.NGN, true),
    exchangeRate: null,
    functionalAmount: moneyValue.make(100_00, SYSTEM_CURRENCIES.NGN, true),
    side: EJournalSide.Debit,
    description: 'Debit cash',
    meta: null,
    version: 1,
    createdAt,
    updatedAt,
    header: {
      sourceType: EJournalEntrySourceType.Transfer,
      memo: 'Cash transfer',
      status: EJournalEntryStatus.Posted,
      effectiveDate,
      postedAt,
      voidedAt,
      voidingEntryId: null,
      version: 1,
      createdBy: createdBy,
      createdAt,
      updatedAt,
    },
  };

  const lineModel: IJournalLineModel = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id,
    entryId,
    accountId,
    counterpartyId: counterpartyId,
    sequenceOrder: 1,
    amount: 100_00,
    currencyCode: SYSTEM_CURRENCIES.NGN.code,
    exchangeRate: null,
    functionalAmount: 100_00,
    functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
    side: EJournalSide.Debit,
    description: 'Debit cash',
    meta: null,
    version: 1,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };

  const headerModel: IJournalEntryModel = {
    id: entryId,
    accountingEntityId: '123e4567-e89b-12d3-a456-426614174006',
    sourceType: EJournalEntrySourceType.Transfer,
    memo: 'Cash transfer',
    status: EJournalEntryStatus.Posted,
    effectiveDate: effectiveDate.toISOString(),
    postedAt: postedAt.toISOString(),
    voidedAt: voidedAt.toISOString(),
    voidingEntryId: null,
    version: 1,
    createdBy: createdBy,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };

  const model = {
    line: lineModel,
    header: headerModel,
  };

  describe('toDomain', () => {
    it('maps an account transaction query model to domain', () => {
      expect(accountTransactionMapper.toDomain(model)).toEqual(transaction);
    });

    it('maps nullable journal fields to domain nulls', () => {
      const result = accountTransactionMapper.toDomain({
        line: { ...lineModel, counterpartyId: null },
        header: {
          id: entryId,
          accountingEntityId: '123e4567-e89b-12d3-a456-426614174006',
          sourceType: EJournalEntrySourceType.Transfer,
          memo: null,
          status: EJournalEntryStatus.Posted,
          effectiveDate: effectiveDate.toISOString(),
          postedAt: null,
          voidedAt: null,
          voidingEntryId: null,
          version: 1,
          createdBy: createdBy,
          createdAt: createdAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
        },
      });

      expect(result).toMatchObject({
        counterpartyId: null,
      });
      expect(result.header).toMatchObject({
        memo: null,
        postedAt: null,
        voidedAt: null,
        voidingEntryId: null,
      });
    });
  });

  describe('toDto', () => {
    it('maps an account transaction to a DTO', () => {
      const dto = accountTransactionMapper.toDto(transaction);

      expect(dto).toEqual({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id,
        entryId,
        accountId,
        counterpartyId: counterpartyId,
        sequenceOrder: 1,
        amount: {
          amount: 100_00,
          currencyCode: SYSTEM_CURRENCIES.NGN.code,
          isMinorUnit: true,
        },
        exchangeRate: null,
        functionalAmount: {
          amount: 100_00,
          currencyCode: SYSTEM_CURRENCIES.NGN.code,
          isMinorUnit: true,
        },
        side: EJournalSide.Debit,
        description: 'Debit cash',
        createdAt,
        updatedAt,
        header: {
          sourceType: transaction.header.sourceType,
          memo: transaction.header.memo,
          status: transaction.header.status,
          effectiveDate,
          postedAt,
          voidedAt,
          voidingEntryId: null,
          createdBy: createdBy,
          createdAt,
          updatedAt,
        },
      });
      expect(dto).not.toHaveProperty('version');
      expect(dto.header).not.toHaveProperty('version');
    });

    it('maps nullable journal fields to DTO nulls', () => {
      const result = accountTransactionMapper.toDto({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id,
        entryId,
        accountId,
        counterpartyId: null,
        sequenceOrder: 1,
        amount: moneyValue.make(100_00, SYSTEM_CURRENCIES.NGN, true),
        exchangeRate: null,
        functionalAmount: moneyValue.make(100_00, SYSTEM_CURRENCIES.NGN, true),
        side: EJournalSide.Debit,
        description: 'Debit cash',
        meta: null,
        version: 1,
        createdAt,
        updatedAt,
        header: {
          sourceType: EJournalEntrySourceType.Transfer,
          memo: null,
          status: EJournalEntryStatus.Posted,
          effectiveDate,
          postedAt: null,
          voidedAt: null,
          voidingEntryId: null,
          version: 1,
          createdBy: createdBy,
          createdAt,
          updatedAt,
        },
      });

      expect(result).toMatchObject({
        counterpartyId: null,
      });
      expect(result.header).toMatchObject({
        memo: null,
        postedAt: null,
        voidedAt: null,
        voidingEntryId: null,
      });
    });
  });
});
