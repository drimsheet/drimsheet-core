import { TEntityId } from '@shared/types/uuid';

import getJournalLineDescription from '@domain/journal-entry/entities/helpers/get-description.helper';
import getOppositeJournalSide from '@domain/journal-entry/entities/helpers/get-opposite-side.helper';
import journalLineEntity from '@domain/journal-entry/entities/journal-line.entity';
import journalLineValidation from '@domain/journal-entry/entities/validations/journal-line.validation';
import { EJournalLineItemEvent } from '@domain/journal-entry/events/journal-line-item.events';
import { EJournalLineAuditAction } from '@domain/journal-entry/types/journal-entry-audit.types';
import {
  EJournalSide,
  UJournalSide,
} from '@domain/journal-entry/types/journal-line.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import { EExchangeRateType } from '@domain/money/types/exchange-rate.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';
import moneyValue from '@domain/money/values/money.vo';

type TMakePayload = Parameters<typeof journalLineEntity.make>[1];
type TEntryPayload = Parameters<typeof journalLineEntity.make>[0];

describe('JournalLineItem Entity', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-15T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('make', () => {
    let validEntryPayload: TEntryPayload;
    let validPayload: TMakePayload;

    beforeEach(() => {
      validEntryPayload = {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: '2b4c10ab-5c31-419b-ab29-688001d9f8e4' as TEntityId,
        memo: 'General Memo',
        createdAt: new Date('2026-04-15T00:00:00.000Z'),
      };

      validPayload = {
        accountId: 'd571fba2-d5cb-43dc-8e6c-2f3b97b0a70f' as TEntityId,
        counterpartyId: '3c5d72bc-1d2a-4a8b-8c0d-1e2f3a4b5c6d' as TEntityId,
        sequenceOrder: 1,
        amount: moneyValue.make(100.0, SYSTEM_CURRENCIES.EUR, false),
        exchangeRate: exchangeRateValue.make({
          baseCurrencyCode: SYSTEM_CURRENCIES.EUR.code,
          targetCurrencyCode: SYSTEM_CURRENCIES.USD.code,
          rate: 1.1,
          type: EExchangeRateType.Official,
          asOf: new Date('2026-04-14T00:00:00.000Z'),
          source: 'Open Exchange Rates',
        }),
        side: EJournalSide.Debit,
        description: 'Line item description',
        functionalCurrency: SYSTEM_CURRENCIES.USD,
      };
    });

    it('should successfully create a journal line item with valid inputs', () => {
      const [lineItem, events, audit] = journalLineEntity.make(
        validEntryPayload,
        validPayload
      );

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(EJournalLineItemEvent.Created);
      expect(events[0].data).toEqual(lineItem);

      expect(typeof lineItem.id).toBe('string');
      expect(lineItem.id.length).toBeGreaterThan(0);
      expect(lineItem.entryId).toBe(validEntryPayload.id);
      expect(lineItem.accountId).toBe(validPayload.accountId);
      expect(lineItem.counterpartyId).toBe(validPayload.counterpartyId);
      expect(lineItem.sequenceOrder).toBe(1);
      expect(lineItem.amount.currency).toEqual(SYSTEM_CURRENCIES.EUR);
      expect(lineItem.exchangeRate?.rate).toBe(1.1);

      expect(lineItem.functionalAmount.amount).toBe(11_000n);
      expect(lineItem.functionalAmount.currency).toEqual(SYSTEM_CURRENCIES.USD);

      expect(lineItem.side).toBe(EJournalSide.Debit);
      expect(lineItem.description).toBe('Line item description');
      expect(lineItem.meta).toBeNull();
      expect(lineItem.createdAt).toEqual(validEntryPayload.createdAt);
      expect(lineItem.updatedAt).toEqual(validEntryPayload.createdAt);

      expect(Object.isFrozen(lineItem)).toBe(true);
      expect(audit).toEqual({
        entityId: lineItem.id,
        entityVersion: 1,
        action: EJournalLineAuditAction.Created,
        diff: {
          before: null,
          after: lineItem,
        },
        occurredAt: lineItem.updatedAt,
      });
      expect(Object.isFrozen(audit)).toBe(true);
    });

    it('should fall back to entry memo if payload description is missing', () => {
      const payloadWithoutDesc: TMakePayload = {
        ...validPayload,
        description: null,
      };

      const [lineItem] = journalLineEntity.make(
        validEntryPayload,
        payloadWithoutDesc
      );

      expect(lineItem.description).toBe('General Memo');
    });

    it.each([
      [SYSTEM_CURRENCIES.USD, 100n, 150, SYSTEM_CURRENCIES.JPY, 150n],
      [SYSTEM_CURRENCIES.JPY, 150n, 0.006, SYSTEM_CURRENCIES.USD, 90n],
    ])(
      'creates a line from %o %s at %s with %o %s functional minor units',
      (source, amount, rate, target, expected) => {
        const transactionAmount = moneyValue.make(amount, source, true);
        const [line, events, audit] = journalLineEntity.make(
          validEntryPayload,
          {
            ...validPayload,
            amount: transactionAmount,
            functionalCurrency: target,
            exchangeRate: exchangeRateValue.make({
              baseCurrencyCode: source.code,
              targetCurrencyCode: target.code,
              rate,
              type: EExchangeRateType.Official,
              asOf: new Date('2026-04-14T00:00:00.000Z'),
              source: 'test',
            }),
          }
        );

        const expectedFunctionalAmount = moneyValue.make(
          expected,
          target,
          true
        );
        expect(line.amount).toBe(transactionAmount);
        expect(line.functionalAmount).toEqual(expectedFunctionalAmount);
        expect(events[0].data.functionalAmount).toEqual(
          expectedFunctionalAmount
        );
        expect(audit.diff.after?.functionalAmount).toEqual(
          expectedFunctionalAmount
        );

        const [updatedLine] = journalLineEntity.update(line, {
          ...line,
          amount: moneyValue.add(transactionAmount, transactionAmount),
        });

        expect(updatedLine.functionalAmount.amount).toBe(expected * 2n);
        expect(updatedLine.functionalAmount.currency).toBe(target);
      }
    );

    it('should throw an AppError if side is invalid', () => {
      const invalidPayload = {
        ...validPayload,
        side: 'invalid' as UJournalSide,
      };

      expect(() =>
        journalLineEntity.make(validEntryPayload, invalidPayload)
      ).toThrow();
    });

    it('should throw an AppError if counterparty ID is invalid', () => {
      expect(() =>
        journalLineEntity.make(validEntryPayload, {
          ...validPayload,
          counterpartyId: 'invalid' as TEntityId,
        })
      ).toThrow();
    });

    it('should successfully create a journal line item for same currency without exchange rate', () => {
      const sameCurrencyPayload = {
        ...validPayload,
        amount: moneyValue.make(100.0, SYSTEM_CURRENCIES.USD, false),
        functionalCurrency: SYSTEM_CURRENCIES.USD,
        exchangeRate: null,
      };

      const [lineItem] = journalLineEntity.make(
        validEntryPayload,
        sameCurrencyPayload
      );

      expect(lineItem.exchangeRate).toBeNull();
      expect(lineItem.amount).toEqual(sameCurrencyPayload.amount);
      expect(lineItem.functionalAmount).toEqual(sameCurrencyPayload.amount);
    });
  });

  describe('update', () => {
    const entryPayload: TEntryPayload = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: '2b4c10ab-5c31-419b-ab29-688001d9f8e4' as TEntityId,
      memo: 'General Memo',
      createdAt: new Date('2026-04-15T00:00:00.000Z'),
    };
    const makePayload: TMakePayload = {
      accountId: 'd571fba2-d5cb-43dc-8e6c-2f3b97b0a70f' as TEntityId,
      counterpartyId: null,
      sequenceOrder: 1,
      amount: moneyValue.make(100, SYSTEM_CURRENCIES.USD, false),
      exchangeRate: null,
      side: EJournalSide.Debit,
      description: 'Before',
      functionalCurrency: SYSTEM_CURRENCIES.USD,
    };

    it('should update the line and return its event and audit', () => {
      const [line] = journalLineEntity.make(entryPayload, makePayload);

      const [updatedLine, events, audit] = journalLineEntity.update(line, {
        ...line,
        description: 'After',
      });

      expect(updatedLine).toMatchObject({
        id: line.id,
        entryId: line.entryId,
        description: 'After',
        version: 2,
      });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: EJournalLineItemEvent.Updated,
        data: updatedLine,
      });
      expect(audit).toMatchObject({
        entityId: line.id,
        entityVersion: 2,
        action: EJournalLineAuditAction.Updated,
      });
    });

    it('should return the existing line when no properties changed', () => {
      const [line] = journalLineEntity.make(entryPayload, makePayload);

      const [unchangedLine, events, audit] = journalLineEntity.update(
        line,
        line
      );

      expect(unchangedLine).toBe(line);
      expect(events).toEqual([]);
      expect(audit).toBeNull();
    });

    it('should recalculate functional amount when an exchange rate is supplied', () => {
      const [line] = journalLineEntity.make(entryPayload, {
        ...makePayload,
        amount: moneyValue.make(100, SYSTEM_CURRENCIES.EUR, false),
        exchangeRate: exchangeRateValue.make({
          baseCurrencyCode: SYSTEM_CURRENCIES.EUR.code,
          targetCurrencyCode: SYSTEM_CURRENCIES.USD.code,
          rate: 1.1,
          type: EExchangeRateType.Official,
          asOf: new Date('2026-04-14T00:00:00.000Z'),
          source: 'Open Exchange Rates',
        }),
        functionalCurrency: SYSTEM_CURRENCIES.USD,
      });

      const [updatedLine] = journalLineEntity.update(line, {
        ...line,
        description: 'After',
      });

      expect(updatedLine.functionalAmount.amount).toBe(11_000n);
      expect(updatedLine.functionalAmount.currency).toEqual(
        SYSTEM_CURRENCIES.USD
      );
    });
  });

  describe('Helpers', () => {
    describe('validateSide', () => {
      it('should not throw for valid sides', () => {
        expect(() =>
          journalLineValidation.validateSide(EJournalSide.Debit)
        ).not.toThrow();
        expect(() =>
          journalLineValidation.validateSide(EJournalSide.Credit)
        ).not.toThrow();
      });

      it('should throw an AppError for an invalid side', () => {
        expect(() =>
          journalLineValidation.validateSide('invalid' as UJournalSide)
        ).toThrow();
      });
    });

    describe('getJournalLineDescription', () => {
      it('should return trimmed description', () => {
        expect(getJournalLineDescription('  test desc  ')).toBe('test desc');
      });

      it('should return null if value is empty or null', () => {
        expect(getJournalLineDescription(null)).toBeNull();
        expect(getJournalLineDescription(undefined)).toBeNull();
        expect(getJournalLineDescription('')).toBeNull();
      });

      it('should throw if description is too long', () => {
        const longDesc = 'a'.repeat(101);
        expect(() => getJournalLineDescription(longDesc)).toThrow();
      });
    });

    describe('validateExchangeRate', () => {
      const validExchangeRate = exchangeRateValue.make({
        baseCurrencyCode: SYSTEM_CURRENCIES.EUR.code,
        targetCurrencyCode: SYSTEM_CURRENCIES.USD.code,
        rate: 1.1,
        type: EExchangeRateType.Official,
        asOf: new Date('2026-04-14T00:00:00.000Z'),
        source: 'Open Exchange Rates',
      });

      it('should throw if same currency but exchange rate is provided', () => {
        expect(() =>
          journalLineValidation.validateExchangeRate({
            amount: moneyValue.make(100.0, SYSTEM_CURRENCIES.USD, false),
            functionalCurrency: SYSTEM_CURRENCIES.USD,
            exchangeRate: validExchangeRate,
          })
        ).toThrow();
      });

      it('should return if same currency and exchange rate is null', () => {
        expect(() =>
          journalLineValidation.validateExchangeRate({
            amount: moneyValue.make(100.0, SYSTEM_CURRENCIES.USD, false),
            functionalCurrency: SYSTEM_CURRENCIES.USD,
            exchangeRate: null,
          })
        ).not.toThrow();
      });

      it('should throw if different currencies and exchange rate is null', () => {
        expect(() =>
          journalLineValidation.validateExchangeRate({
            amount: moneyValue.make(100.0, SYSTEM_CURRENCIES.EUR, false),
            functionalCurrency: SYSTEM_CURRENCIES.USD,
            exchangeRate: null,
          })
        ).toThrow();
      });

      it('should throw if exchange rate base does not match amount currency', () => {
        const invalidBaseRate = exchangeRateValue.make({
          baseCurrencyCode: SYSTEM_CURRENCIES.USD.code, // Mismatch: should be SYSTEM_CURRENCIES.EUR
          targetCurrencyCode: SYSTEM_CURRENCIES.USD.code,
          rate: 1.1,
          type: EExchangeRateType.Official,
          asOf: new Date('2026-04-14T00:00:00.000Z'),
          source: 'Open Exchange Rates',
        });

        expect(() =>
          journalLineValidation.validateExchangeRate({
            amount: moneyValue.make(100.0, SYSTEM_CURRENCIES.EUR, false),
            functionalCurrency: SYSTEM_CURRENCIES.USD,
            exchangeRate: invalidBaseRate,
          })
        ).toThrow();
      });

      it('should throw if exchange rate target does not match functional currency', () => {
        const invalidTargetRate = exchangeRateValue.make({
          baseCurrencyCode: SYSTEM_CURRENCIES.EUR.code,
          targetCurrencyCode: SYSTEM_CURRENCIES.EUR.code, // Mismatch: should be SYSTEM_CURRENCIES.USD
          rate: 1.1,
          type: EExchangeRateType.Official,
          asOf: new Date('2026-04-14T00:00:00.000Z'),
          source: 'Open Exchange Rates',
        });

        expect(() =>
          journalLineValidation.validateExchangeRate({
            amount: moneyValue.make(100.0, SYSTEM_CURRENCIES.EUR, false),
            functionalCurrency: SYSTEM_CURRENCIES.USD,
            exchangeRate: invalidTargetRate,
          })
        ).toThrow();
      });
    });

    describe('getOppositeJournalSide', () => {
      it('should return Credit when given Debit', () => {
        expect(getOppositeJournalSide(EJournalSide.Debit)).toBe(
          EJournalSide.Credit
        );
      });

      it('should return Debit when given Credit', () => {
        expect(getOppositeJournalSide(EJournalSide.Credit)).toBe(
          EJournalSide.Debit
        );
      });
    });
  });
});
