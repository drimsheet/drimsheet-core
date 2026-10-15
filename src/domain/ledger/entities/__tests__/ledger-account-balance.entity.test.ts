import { TCreationOmits } from '@shared/types/creation-omits.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import ledgerAccountBalanceAdjustmentValidation from '@domain/accounting/entities/validations/ledger-account-balance-adjustment.validation';
import { IJournalLine } from '@domain/journal-entry/types/journal-line.types';
import getLedgerAccountBalanceEffect from '@domain/ledger/entities/helpers/get-effect-from-amount.helper';
import ledgerAccountBalanceEntity from '@domain/ledger/entities/ledger-account-balance.entity';
import ledgerAccountBalanceValidation from '@domain/ledger/entities/validations/ledger-account-balance.validation';
import ledgerAccountBalanceError from '@domain/ledger/errors/ledger-account-balance.error';
import {
  ELedgerAccountBalanceEffect,
  ILedgerAccountBalanceAdjustment,
  ULedgerAccountBalanceEffect,
} from '@domain/ledger/types/ledger-account-balance.types';
import currencyEntity from '@domain/money/entities/currency.entity';
import { IMoney } from '@domain/money/types/money.types';
import moneyValue from '@domain/money/values/money.vo';

describe('ledgerAccountBalanceEntity', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('preserves the balance for zero deltas while still rejecting incompatible currencies', () => {
    const balance = ledgerAccountBalanceEntity.make({
      createdBy: generateUUID(),
      ledgerAccountId: generateUUID(),
      accountingEntityId: generateUUID(),
      accountMaterializedPath: '100000',
      currencyCode: 'NGN',
      functionalCurrencyCode: 'USD',
    });
    const payload = {
      createdBy: balance.createdBy,
      ledgerAccountId: balance.ledgerAccountId,
      journalEntryId: generateUUID(),
      amount: moneyValue.makeZeroAmount(currencyEntity.getByCode('NGN')),
      functionalAmount: moneyValue.makeZeroAmount(
        currencyEntity.getByCode('USD')
      ),
    };
    const { newBalance } = ledgerAccountBalanceEntity.adjust(balance, payload);
    expect(newBalance).toBe(balance);
    expect(newBalance.version).toBe(balance.version);
    expect(newBalance.updatedAt).toBe(balance.updatedAt);
    expect(() =>
      ledgerAccountBalanceEntity.adjust(balance, {
        ...payload,
        amount: payload.functionalAmount,
      })
    ).toThrow();
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

    it('creates a version-one balance with supplied amounts in each currency', () => {
      const balance = ledgerAccountBalanceEntity.make({
        ...validPayload,
        amount: -500n,
        functionalAmount: -250n,
      });

      expect(balance.amount).toEqual({
        amount: -500n,
        currency: currencyEntity.getByCode('NGN'),
      });
      expect(balance.functionalAmount).toEqual({
        amount: -250n,
        currency: currencyEntity.getByCode('USD'),
      });
      expect(balance.version).toBe(1);
      expect(Object.isFrozen(balance)).toBe(true);
      expect(Object.isFrozen(balance.amount)).toBe(true);
      expect(Object.isFrozen(balance.functionalAmount)).toBe(true);
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

  describe('cloneToControlAccount', () => {
    const makeBalance = () =>
      ledgerAccountBalanceEntity.make({
        createdBy: generateUUID(),
        ledgerAccountId: generateUUID(),
        accountingEntityId: generateUUID(),
        accountMaterializedPath: '401000.401001',
        currencyCode: 'NGN',
        functionalCurrencyCode: 'USD',
      });

    it.each([0n, 500n, -500n])(
      'clones %s into a new control balance with fresh creation metadata',
      (amount) => {
        const zero = makeBalance();
        const original = ledgerAccountBalanceEntity.adjust(zero, {
          createdBy: zero.createdBy,
          ledgerAccountId: zero.ledgerAccountId,
          journalEntryId: generateUUID(),
          amount: { amount, currency: zero.amount.currency },
          functionalAmount: {
            amount: amount / 2n,
            currency: zero.functionalAmount.currency,
          },
        }).newBalance;
        const controlAccountId = generateUUID();
        const createdBy = generateUUID();
        const cloneTime = new Date('2026-04-02T00:00:00.000Z');
        jest.setSystemTime(cloneTime);

        const cloned = ledgerAccountBalanceEntity.cloneToControlAccount(
          original,
          controlAccountId,
          createdBy
        );

        expect(cloned).toEqual({
          createdBy,
          ledgerAccountId: controlAccountId,
          accountingEntityId: original.accountingEntityId,
          accountMaterializedPath: original.accountMaterializedPath,
          amount: original.amount,
          functionalAmount: original.functionalAmount,
          version: 1,
          createdAt: cloneTime,
          updatedAt: cloneTime,
        });
        expect(cloned).not.toBe(original);
        expect(Object.isFrozen(cloned)).toBe(true);
        expect(Object.isFrozen(cloned.amount)).toBe(true);
        expect(Object.isFrozen(cloned.functionalAmount)).toBe(true);
        expect(original.ledgerAccountId).toBe(zero.ledgerAccountId);
        expect(original.createdBy).toBe(zero.createdBy);
        expect(original.amount.amount).toBe(amount);
        expect(original.functionalAmount.amount).toBe(amount / 2n);
        expect(original.version).toBe(amount === 0n ? 1 : 2);
        expect(original.updatedAt).toEqual(
          new Date('2026-04-01T00:00:00.000Z')
        );
      }
    );

    it.each(['account', 'actor'])(
      'rejects an invalid destination %s identity',
      (invalidIdentity) => {
        const invalidId = 'invalid' as TEntityId;
        expect(() =>
          ledgerAccountBalanceEntity.cloneToControlAccount(
            makeBalance(),
            invalidIdentity === 'account' ? invalidId : generateUUID(),
            invalidIdentity === 'actor' ? invalidId : generateUUID()
          )
        ).toThrow();
      }
    );
  });

  describe('cloneAdjustmentToControlAccount', () => {
    const makeAdjustment = (amount: bigint) => {
      const balance = ledgerAccountBalanceEntity.make({
        createdBy: generateUUID(),
        ledgerAccountId: generateUUID(),
        accountingEntityId: generateUUID(),
        accountMaterializedPath: '401000.401001',
        currencyCode: 'NGN',
        functionalCurrencyCode: 'USD',
      });
      return ledgerAccountBalanceEntity.adjust(balance, {
        createdBy: balance.createdBy,
        ledgerAccountId: balance.ledgerAccountId,
        journalEntryId: generateUUID(),
        amount: moneyValue.make(amount, balance.amount.currency, true),
        functionalAmount: moneyValue.make(
          amount / 2n,
          balance.functionalAmount.currency,
          true
        ),
      }).adjustment;
    };

    it.each([0n, 500n, -500n])(
      'clones %s with new identity and preserves historical amounts and attribution',
      (amount) => {
        const original = makeAdjustment(amount);
        const originalSnapshot = structuredClone(original);
        const controlAccountId = generateUUID();
        jest.setSystemTime(new Date('2026-04-02T00:00:00.000Z'));

        const cloned =
          ledgerAccountBalanceEntity.cloneAdjustmentToControlAccount(
            original,
            controlAccountId
          );
        const anotherClone =
          ledgerAccountBalanceEntity.cloneAdjustmentToControlAccount(
            original,
            controlAccountId
          );

        expect(cloned).toEqual({
          ...originalSnapshot,
          id: expect.any(String),
          ledgerAccountId: controlAccountId,
        });
        expect(cloned.id).not.toBe(original.id);
        expect(cloned.id).not.toBe(anotherClone.id);
        expect(cloned.createdAt).toEqual(new Date('2026-04-01T00:00:00.000Z'));
        expect(Object.isFrozen(cloned)).toBe(true);
        expect(Object.isFrozen(cloned.amount)).toBe(true);
        expect(Object.isFrozen(cloned.functionalAmount)).toBe(true);
        expect(original).toEqual(originalSnapshot);
      }
    );

    it('rejects an invalid target account identity', () => {
      const original = makeAdjustment(500n);
      expect(() =>
        ledgerAccountBalanceEntity.cloneAdjustmentToControlAccount(
          original,
          'invalid' as TEntityId
        )
      ).toThrow(ledgerAccountBalanceError.InvalidLedgerAccountId);
    });
  });

  describe('updateAccountCode', () => {
    const makeBalance = () =>
      ledgerAccountBalanceEntity.make({
        createdBy: generateUUID(),
        ledgerAccountId: generateUUID(),
        accountingEntityId: generateUUID(),
        accountMaterializedPath: '401000.401001',
        currencyCode: 'NGN',
        functionalCurrencyCode: 'USD',
        amount: 500n,
        functionalAmount: 250n,
      });

    it('changes the path and update metadata while preserving identity and balances', () => {
      const original = makeBalance();
      jest.setSystemTime(new Date('2026-04-02T00:00:00.000Z'));

      const updated = ledgerAccountBalanceEntity.updateAccountCode(
        original,
        '401000.401001.401002'
      );

      expect(updated).toEqual({
        ...original,
        accountMaterializedPath: '401000.401001.401002',
        version: original.version + 1,
        updatedAt: new Date('2026-04-02T00:00:00.000Z'),
      });
      expect(Object.isFrozen(updated)).toBe(true);
      expect(Object.isFrozen(updated.amount)).toBe(true);
      expect(Object.isFrozen(updated.functionalAmount)).toBe(true);
      expect(original.accountMaterializedPath).toBe('401000.401001');
      expect(original.version).toBe(1);
    });

    it('returns the same balance for an unchanged path', () => {
      const original = makeBalance();
      expect(
        ledgerAccountBalanceEntity.updateAccountCode(
          original,
          original.accountMaterializedPath
        )
      ).toBe(original);
    });

    it('rejects an invalid account path', () => {
      expect(() =>
        ledgerAccountBalanceEntity.updateAccountCode(makeBalance(), '123')
      ).toThrow();
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

describe('ledgerAccountBalanceEntity.changeFunctionalCurrency', () => {
  const payload = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    ledgerAccountId: '123e4567-e89b-12d3-a456-426614174000' as TEntityId,
    accountingEntityId: '923e4567-e89b-12d3-a456-426614174000' as TEntityId,
    accountMaterializedPath: '100000',
    currencyCode: 'GBP',
    functionalCurrencyCode: 'NGN',
  };
  it('changes functional currency only and increments the version', () => {
    const current = ledgerAccountBalanceEntity.make(payload);
    const updated = ledgerAccountBalanceEntity.changeFunctionalCurrency(
      current,
      currencyEntity.getByCode('USD')
    );
    expect(updated).toMatchObject({
      ledgerAccountId: current.ledgerAccountId,
      version: 2,
      functionalAmount: { amount: 0n, currency: { code: 'USD' } },
    });
    expect(updated.amount).toBe(current.amount);
    expect(updated.createdAt).toBe(current.createdAt);
    expect(current.functionalAmount.currency.code).toBe('NGN');
    expect(Object.isFrozen(updated)).toBe(true);
  });
  it('returns the existing balance for the same currency', () => {
    const current = ledgerAccountBalanceEntity.make(payload);
    expect(
      ledgerAccountBalanceEntity.changeFunctionalCurrency(
        current,
        currencyEntity.getByCode('NGN')
      )
    ).toBe(current);
  });
  it.each([{ amount: 1n }, { functionalAmount: 1n }])(
    'rejects nonzero balances %p',
    (amounts) => {
      const current = ledgerAccountBalanceEntity.make({
        ...payload,
        ...amounts,
      });
      expect(() =>
        ledgerAccountBalanceEntity.changeFunctionalCurrency(
          current,
          currencyEntity.getByCode('USD')
        )
      ).toThrow();
    }
  );
});
