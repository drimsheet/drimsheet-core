import { TCreationOmits } from '@shared/types/creation-omits.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import ledgerAccountBalanceAdjustmentValidation from '@domain/accounting/entities/validations/ledger-account-balance-adjustment.validation';
import { IJournalLine } from '@domain/journal-entry/types/journal-line.types';
import getLedgerAccountBalanceEffect from '@domain/ledger/entities/helpers/get-effect-from-amount.helper';
import ledgerAccountBalanceEntity from '@domain/ledger/entities/ledger-account-balance.entity';
import ledgerAccountBalanceValidation from '@domain/ledger/entities/validations/ledger-account-balance.validation';
import {
  ELedgerAccountBalanceEffect,
  ILedgerAccountBalanceAdjustment,
  ULedgerAccountBalanceEffect,
} from '@domain/ledger/types/ledger-account-balance.types';
import currencyEntity from '@domain/money/entities/currency.entity';
import { IMoney } from '@domain/money/types/money.types';

describe('ledgerAccountBalanceEntity', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('make', () => {
    const validPayload: Parameters<typeof ledgerAccountBalanceEntity.make>[0] =
      {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        ledgerAccountId: '123e4567-e89b-12d3-a456-426614174000' as TEntityId,
        accountingEntityId: '923e4567-e89b-12d3-a456-426614174000' as TEntityId,
        accountMaterializedPath: '100000',
        currencyCode: 'NGN',
        functionalCurrencyCode: 'USD',
      };

    it('should create a valid ledger account balance', () => {
      const balance = ledgerAccountBalanceEntity.make(validPayload);

      expect(balance).toEqual({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        ledgerAccountId: validPayload.ledgerAccountId,
        accountingEntityId: validPayload.accountingEntityId,
        accountMaterializedPath: validPayload.accountMaterializedPath,
        amount: expect.objectContaining({
          amount: 0n,
          currency: expect.objectContaining({ code: 'NGN' }),
        }),
        functionalAmount: expect.objectContaining({
          amount: 0n,
          currency: expect.objectContaining({ code: 'USD' }),
        }),
        version: 1,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      });
      expect(Object.isFrozen(balance)).toBe(true);
    });

    it('should throw if ledgerAccountId is invalid UUID', () => {
      const payload = {
        ...validPayload,
        ledgerAccountId: 'invalid' as unknown as TEntityId,
      };
      expect(() => ledgerAccountBalanceEntity.make(payload)).toThrow();
    });

    it('should throw if accountingEntityId is invalid UUID', () => {
      const payload = {
        ...validPayload,
        accountingEntityId: 'invalid' as unknown as TEntityId,
      };
      expect(() => ledgerAccountBalanceEntity.make(payload)).toThrow();
    });

    it('should throw if accountMaterializedPath is invalid', () => {
      const payload = {
        ...validPayload,
        accountMaterializedPath: '123',
      };
      expect(() => ledgerAccountBalanceEntity.make(payload)).toThrow();
    });

    it('should throw if currencyCode is invalid', () => {
      const payload = {
        ...validPayload,
        currencyCode: 'INVALID',
      };
      expect(() => ledgerAccountBalanceEntity.make(payload)).toThrow();
    });

    it('should throw if functionalCurrencyCode is invalid', () => {
      const payload = {
        ...validPayload,
        functionalCurrencyCode: 'INVALID',
      };
      expect(() => ledgerAccountBalanceEntity.make(payload)).toThrow();
    });
  });

  describe('changeCurrency', () => {
    const makeBalance = () =>
      ledgerAccountBalanceEntity.make({
        createdBy: generateUUID(),
        ledgerAccountId: generateUUID(),
        accountingEntityId: generateUUID(),
        accountMaterializedPath: '100000.100001',
        currencyCode: 'NGN',
        functionalCurrencyCode: 'NGN',
      });

    it('changes only the zero balance denomination and update metadata, then accepts the new-currency opening amount', () => {
      const original = makeBalance();
      jest.setSystemTime(new Date('2026-04-02T00:00:00.000Z'));
      const updated = ledgerAccountBalanceEntity.changeCurrency(
        original,
        currencyEntity.getByCode('USD')
      );
      expect(updated).toEqual({
        ...original,
        amount: { amount: 0n, currency: currencyEntity.getByCode('USD') },
        version: original.version + 1,
        updatedAt: new Date('2026-04-02T00:00:00.000Z'),
      });
      expect(Object.isFrozen(updated)).toBe(true);
      expect(Object.isFrozen(updated.amount)).toBe(true);
      expect(original.amount.currency.code).toBe('NGN');
      expect(original.version).toBe(1);
      const applied = ledgerAccountBalanceEntity.adjust(updated, {
        ledgerAccountId: original.ledgerAccountId,
        journalEntryId: generateUUID(),
        createdBy: original.createdBy,
        amount: { amount: 100n, currency: currencyEntity.getByCode('USD') },
        functionalAmount: {
          amount: 150_000n,
          currency: currencyEntity.getByCode('NGN'),
        },
      });
      expect(applied.newBalance.amount.amount).toBe(100n);
      expect(applied.newBalance.functionalAmount.amount).toBe(150_000n);
      expect(applied.newBalance.version).toBe(3);
    });

    it('returns the same balance when its currency is unchanged', () => {
      const original = makeBalance();
      expect(
        ledgerAccountBalanceEntity.changeCurrency(
          original,
          currencyEntity.getByCode('NGN')
        )
      ).toBe(original);
    });
  });

  describe('adjust', () => {
    const validMakePayload: Parameters<
      typeof ledgerAccountBalanceEntity.make
    >[0] = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      ledgerAccountId: '123e4567-e89b-12d3-a456-426614174000' as TEntityId,
      accountingEntityId: '923e4567-e89b-12d3-a456-426614174000' as TEntityId,
      accountMaterializedPath: '100000',
      currencyCode: 'NGN',
      functionalCurrencyCode: 'USD',
    };

    let existingBalance: ReturnType<typeof ledgerAccountBalanceEntity.make>;

    beforeEach(() => {
      existingBalance = ledgerAccountBalanceEntity.make(validMakePayload);
    });

    const validAdjustmentPayload: TCreationOmits<
      ILedgerAccountBalanceAdjustment,
      'effect'
    > = {
      ledgerAccountId: '123e4567-e89b-12d3-a456-426614174000' as TEntityId,
      amount: { amount: 100n, currency: currencyEntity.getByCode('NGN') },
      functionalAmount: {
        amount: 150n,
        currency: currencyEntity.getByCode('USD'),
      },
      journalEntryId: '223e4567-e89b-12d3-a456-426614174001' as TEntityId,
      createdBy: '423e4567-e89b-12d3-a456-426614174003' as TEntityId,
    };

    it.each([
      '123e4567-e89b-42d3-a456-426614174000' as TEntityId,
      '123e4567-e89b-42d3-a456-426614174001' as TEntityId,
      'b2222222-2222-4222-8222-222222222222' as TEntityId,
      'c3333333-3333-4333-8333-333333333333' as TEntityId,
    ])('preserves immutable $type creation attribution', (createdBy) => {
      const { adjustment: entity } = ledgerAccountBalanceEntity.adjust(
        existingBalance,
        { ...validAdjustmentPayload, createdBy }
      );
      expect(entity.createdBy).toBe(createdBy);
      expect(Object.isFrozen(entity.createdBy)).toBe(true);
    });

    it('should create a valid ledger account balance adjustment', () => {
      const data = ledgerAccountBalanceEntity.adjust(
        existingBalance,
        validAdjustmentPayload
      );
      const { adjustment, newBalance } = data;

      expect(adjustment).toEqual({
        id: expect.any(String),
        ledgerAccountId: validAdjustmentPayload.ledgerAccountId,
        amount: validAdjustmentPayload.amount,
        functionalAmount: validAdjustmentPayload.functionalAmount,
        journalEntryId: validAdjustmentPayload.journalEntryId,
        effect: ELedgerAccountBalanceEffect.Increase,
        createdBy: validAdjustmentPayload.createdBy,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
      });
      expect(Object.isFrozen(adjustment)).toBe(true);

      expect(newBalance).toEqual({
        ...existingBalance,
        amount: {
          amount: 100n,
          currency: currencyEntity.getByCode('NGN'),
        },
        functionalAmount: {
          amount: 150n,
          currency: currencyEntity.getByCode('USD'),
        },
        version: existingBalance.version + 1,
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      });
      expect(Object.isFrozen(newBalance)).toBe(true);
    });

    it('should throw if ledgerAccountId is invalid UUID', () => {
      const payload = {
        ...validAdjustmentPayload,
        ledgerAccountId: 'invalid' as unknown as TEntityId,
      };
      expect(() =>
        ledgerAccountBalanceEntity.adjust(existingBalance, payload)
      ).toThrow();
    });

    it('should throw if amount is invalid', () => {
      const payload = {
        ...validAdjustmentPayload,
        amount: {
          amount: 100n,
        } as unknown as typeof validAdjustmentPayload.amount, // Missing currency
      };
      expect(() =>
        ledgerAccountBalanceEntity.adjust(existingBalance, payload)
      ).toThrow();
    });

    it('should throw if functionalAmount is invalid', () => {
      const payload = {
        ...validAdjustmentPayload,
        functionalAmount: {
          amount: 100n,
        } as unknown as typeof validAdjustmentPayload.functionalAmount, // Missing currency
      };
      expect(() =>
        ledgerAccountBalanceEntity.adjust(existingBalance, payload)
      ).toThrow();
    });

    it('should throw if journalEntryId is invalid UUID', () => {
      const payload = {
        ...validAdjustmentPayload,
        journalEntryId: 'invalid' as unknown as TEntityId,
      };
      expect(() =>
        ledgerAccountBalanceEntity.adjust(existingBalance, payload)
      ).toThrow();
    });

    it('should throw if createdBy is an invalid actor', () => {
      const payload = {
        ...validAdjustmentPayload,
        createdBy: 'invalid' as unknown as TEntityId,
      };
      expect(() =>
        ledgerAccountBalanceEntity.adjust(existingBalance, payload)
      ).toThrow();
    });

    it('should throw if amount is not an IMoney object', () => {
      const payload = {
        ...validAdjustmentPayload,
        amount: -100 as unknown as typeof validAdjustmentPayload.amount,
      };
      expect(() =>
        ledgerAccountBalanceEntity.adjust(existingBalance, payload)
      ).toThrow();
    });
  });

  describe('validateEffectType', () => {
    it('should not throw for a valid effect type', () => {
      expect(() =>
        ledgerAccountBalanceValidation.validateEffectType(
          ELedgerAccountBalanceEffect.Increase
        )
      ).not.toThrow();
      expect(() =>
        ledgerAccountBalanceValidation.validateEffectType(
          ELedgerAccountBalanceEffect.Decrease
        )
      ).not.toThrow();
      expect(() =>
        ledgerAccountBalanceValidation.validateEffectType(
          ELedgerAccountBalanceEffect.Noop
        )
      ).not.toThrow();
    });

    it('should throw for an invalid effect type', () => {
      // @ts-expect-error: purposefully testing invalid effect
      const invalidEffect: ULedgerAccountBalanceEffect = 'INVALID';
      expect(() =>
        ledgerAccountBalanceValidation.validateEffectType(invalidEffect)
      ).toThrow();
    });
  });

  describe('getLedgerAccountBalanceEffect', () => {
    it('should throw if amount is invalid', () => {
      // @ts-expect-error: purposefully testing invalid amount
      const invalidAmount: IMoney = { amount: 100n };
      expect(() => getLedgerAccountBalanceEffect(invalidAmount)).toThrow();
    });

    it('should return Noop for zero amount', () => {
      const amount = { amount: 0n, currency: currencyEntity.getByCode('NGN') };
      expect(getLedgerAccountBalanceEffect(amount)).toBe(
        ELedgerAccountBalanceEffect.Noop
      );
    });

    it('should return Increase for positive amount', () => {
      const amount = {
        amount: 100n,
        currency: currencyEntity.getByCode('NGN'),
      };
      expect(getLedgerAccountBalanceEffect(amount)).toBe(
        ELedgerAccountBalanceEffect.Increase
      );
    });

    it('should return Decrease for negative amount', () => {
      const amount = {
        amount: -100n,
        currency: currencyEntity.getByCode('NGN'),
      };
      expect(getLedgerAccountBalanceEffect(amount)).toBe(
        ELedgerAccountBalanceEffect.Decrease
      );
    });
  });

  describe('ledgerAccountBalanceAdjustmentValidation', () => {
    describe('validateAccountId', () => {
      const makeJournalLine = (
        id: TEntityId,
        accountId: TEntityId
      ): IJournalLine => ({
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id,
        entryId: '423e4567-e89b-12d3-a456-426614174003' as TEntityId,
        accountId,
        counterpartyId: null,
        sequenceOrder: 1,
        amount: { amount: 100n, currency: currencyEntity.getByCode('NGN') },
        exchangeRate: null,
        functionalAmount: {
          amount: 100n,
          currency: currencyEntity.getByCode('NGN'),
        },
        side: 'debit',
        description: null,
        meta: null,
        version: 1,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      });

      it('should not throw if all journal lines have the same accountId', () => {
        const accountId = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
        const journalLines = [
          makeJournalLine(
            '223e4567-e89b-12d3-a456-426614174001' as TEntityId,
            accountId
          ),
          makeJournalLine(
            '323e4567-e89b-12d3-a456-426614174002' as TEntityId,
            accountId
          ),
        ];
        expect(() =>
          ledgerAccountBalanceAdjustmentValidation.validateAccountId(
            accountId,
            journalLines
          )
        ).not.toThrow();
      });

      it('should throw if any journal line has a different accountId', () => {
        const accountId = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
        const differentAccountId =
          '923e4567-e89b-12d3-a456-426614174000' as TEntityId;
        const journalLines = [
          makeJournalLine(
            '223e4567-e89b-12d3-a456-426614174001' as TEntityId,
            accountId
          ),
          makeJournalLine(
            '323e4567-e89b-12d3-a456-426614174002' as TEntityId,
            differentAccountId
          ),
        ];
        expect(() =>
          ledgerAccountBalanceAdjustmentValidation.validateAccountId(
            accountId,
            journalLines
          )
        ).toThrow();
      });
    });
  });
});
