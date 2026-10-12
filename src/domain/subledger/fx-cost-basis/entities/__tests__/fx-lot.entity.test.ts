import { TCreationOmits } from '@shared/types/creation-omits.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import { EExchangeRateType } from '@domain/money/types/exchange-rate.types';
import moneyValue from '@domain/money/values/money.vo';
import fxCostBasisLotEntity from '@domain/subledger/fx-cost-basis/entities/lot.entity';
import lotValidation from '@domain/subledger/fx-cost-basis/entities/validations/lot.validation';
import fxCostBasisLotError from '@domain/subledger/fx-cost-basis/errors/lot.error';
import { EFxCostBasisLotEvent } from '@domain/subledger/fx-cost-basis/events/lot.events';
import {
  EFxCostBasisLotAuditAction,
  EFxCostBasisLotStatus,
  IFxCostBasisLot,
} from '@domain/subledger/fx-cost-basis/types/lot.types';

describe('fxCostBasisLotEntity', () => {
  const MOCK_DATE = new Date('2026-04-01T00:00:00.000Z');
  let validPayload: TCreationOmits<IFxCostBasisLot, 'version'>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(MOCK_DATE);

    validPayload = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      ledgerAccountId: generateUUID(),
      accountingEntityId: generateUUID(),
      status: EFxCostBasisLotStatus.Open,
      originalQuantity: moneyValue.make(100, SYSTEM_CURRENCIES.USD, false),
      remainingQuantity: moneyValue.make(100, SYSTEM_CURRENCIES.USD, false),
      costBasis: moneyValue.make(150000, SYSTEM_CURRENCIES.NGN, false),
      remainingCostBasis: moneyValue.make(150000, SYSTEM_CURRENCIES.NGN, false),
      acquisitionRate: {
        currencyPair: 'USD/NGN',
        baseCurrencyCode: 'USD',
        targetCurrencyCode: 'NGN',
        rate: 1500,
        type: EExchangeRateType.Negotiated,
        asOf: new Date('2026-03-31T00:00:00.000Z'),
        source: 'bank',
        createdAt: new Date('2026-03-31T00:00:00.000Z'),
      },
      acquisitionDate: new Date('2026-03-31T00:00:00.000Z'),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('make', () => {
    it('creates a validated fx lot with event and audit', () => {
      const [entity, events, audit] = fxCostBasisLotEntity.make(validPayload);

      expect(entity.id).toBeDefined();
      expect(entity.ledgerAccountId).toBe(validPayload.ledgerAccountId);
      expect(entity.accountingEntityId).toBe(validPayload.accountingEntityId);
      expect(entity.status).toBe(EFxCostBasisLotStatus.Open);
      expect(entity.originalQuantity).toBe(validPayload.originalQuantity);
      expect(entity.remainingQuantity).toBe(validPayload.remainingQuantity);
      expect(entity.costBasis).toBe(validPayload.costBasis);
      expect(entity.remainingCostBasis).toBe(validPayload.remainingCostBasis);
      expect(entity.acquisitionRate).toBe(validPayload.acquisitionRate);
      expect(entity.acquisitionDate).toBe(validPayload.acquisitionDate);
      expect(entity.createdAt).toEqual(MOCK_DATE);
      expect(entity.updatedAt).toEqual(MOCK_DATE);
      expect(Object.isFrozen(entity)).toBe(true);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(EFxCostBasisLotEvent.Created);
      expect(events[0].data).toEqual(entity);
      expect(events[0].occurredAt).toEqual(MOCK_DATE);

      expect(audit).toEqual({
        entityId: entity.id,
        entityVersion: entity.version,
        action: EFxCostBasisLotAuditAction.Created,
        diff: {
          before: null,
          after: entity,
        },
        occurredAt: entity.updatedAt,
      });
      expect(Object.isFrozen(audit)).toBe(true);
    });

    it('throws when ledger account id validation fails', () => {
      const invalidPayload = {
        ...validPayload,
        ledgerAccountId: 'invalid-id',
      };

      expect(() =>
        // @ts-expect-error testing invalid ledger account id
        fxCostBasisLotEntity.make(invalidPayload)
      ).toThrow(fxCostBasisLotError.InvalidLedgerAccountId);
    });

    it('throws when accounting entity id validation fails', () => {
      const invalidPayload = {
        ...validPayload,
        accountingEntityId: 'invalid-id',
      };

      expect(() =>
        // @ts-expect-error testing invalid accounting entity id
        fxCostBasisLotEntity.make(invalidPayload)
      ).toThrow(fxCostBasisLotError.InvalidAccountingEntityId);
    });

    it('throws when acquisition rate validation fails', () => {
      expect(() =>
        fxCostBasisLotEntity.make({
          ...validPayload,
          acquisitionRate: {
            ...validPayload.acquisitionRate,
            rate: -1,
          },
        })
      ).toThrow();
    });

    it('throws when acquisition date is in the future', () => {
      expect(() =>
        fxCostBasisLotEntity.make({
          ...validPayload,
          acquisitionDate: new Date('2026-04-02T00:00:00.000Z'),
        })
      ).toThrow(fxCostBasisLotError.InvalidAcquisitionDate);
    });
  });

  describe('consume', () => {
    it('partially consumes an open lot and records an audited disposition', () => {
      const [lot] = fxCostBasisLotEntity.make(validPayload);

      const [updated, events, audit] = fxCostBasisLotEntity.consume(
        lot,
        moneyValue.make(40, SYSTEM_CURRENCIES.USD, false),
        moneyValue.make(60000, SYSTEM_CURRENCIES.NGN, false)
      );

      expect(updated.remainingQuantity).toEqual(
        moneyValue.make(60, SYSTEM_CURRENCIES.USD, false)
      );
      expect(updated.remainingCostBasis).toEqual(
        moneyValue.make(90000, SYSTEM_CURRENCIES.NGN, false)
      );
      expect(updated.status).toBe(EFxCostBasisLotStatus.Open);
      expect(updated.version).toBe(lot.version + 1);
      expect(events).toHaveLength(1);
      expect(audit.diff).toEqual({ before: lot, after: updated });
    });

    it('closes a fully consumed lot without leaving cost-basis dust', () => {
      const [lot] = fxCostBasisLotEntity.make(validPayload);

      const [updated] = fxCostBasisLotEntity.consume(
        lot,
        lot.remainingQuantity,
        lot.remainingCostBasis
      );

      expect(updated.status).toBe(EFxCostBasisLotStatus.Closed);
      expect(moneyValue.isZeroAmount(updated.remainingQuantity)).toBe(true);
      expect(moneyValue.isZeroAmount(updated.remainingCostBasis)).toBe(true);
    });

    it.each([
      [
        'zero quantity',
        moneyValue.make(0, SYSTEM_CURRENCIES.USD, false),
        moneyValue.make(1, SYSTEM_CURRENCIES.NGN, false),
        fxCostBasisLotError.InvalidConsumptionQuantity,
      ],
      [
        'excess quantity',
        moneyValue.make(101, SYSTEM_CURRENCIES.USD, false),
        moneyValue.make(1, SYSTEM_CURRENCIES.NGN, false),
        fxCostBasisLotError.InvalidConsumptionQuantity,
      ],
      [
        'quantity currency mismatch',
        moneyValue.make(1, SYSTEM_CURRENCIES.EUR, false),
        moneyValue.make(1, SYSTEM_CURRENCIES.NGN, false),
        fxCostBasisLotError.InvalidConsumptionQuantity,
      ],
      [
        'zero cost basis',
        moneyValue.make(1, SYSTEM_CURRENCIES.USD, false),
        moneyValue.make(0, SYSTEM_CURRENCIES.NGN, false),
        fxCostBasisLotError.InvalidConsumptionCostBasis,
      ],
      [
        'excess cost basis',
        moneyValue.make(1, SYSTEM_CURRENCIES.USD, false),
        moneyValue.make(150001, SYSTEM_CURRENCIES.NGN, false),
        fxCostBasisLotError.InvalidConsumptionCostBasis,
      ],
      [
        'cost-basis currency mismatch',
        moneyValue.make(1, SYSTEM_CURRENCIES.USD, false),
        moneyValue.make(1, SYSTEM_CURRENCIES.USD, false),
        fxCostBasisLotError.InvalidConsumptionCostBasis,
      ],
    ])('rejects %s', (_, quantity, costBasis, ErrorClass) => {
      const [lot] = fxCostBasisLotEntity.make(validPayload);

      expect(() =>
        fxCostBasisLotEntity.consume(lot, quantity, costBasis)
      ).toThrow(ErrorClass);
    });

    it('rejects a closed lot', () => {
      const [lot] = fxCostBasisLotEntity.make(validPayload);
      const [closed] = fxCostBasisLotEntity.consume(
        lot,
        lot.remainingQuantity,
        lot.remainingCostBasis
      );

      expect(() =>
        fxCostBasisLotEntity.consume(
          closed,
          moneyValue.make(1, SYSTEM_CURRENCIES.USD, false),
          moneyValue.make(1500, SYSTEM_CURRENCIES.NGN, false)
        )
      ).toThrow(fxCostBasisLotError.ClosedLot);
    });

    it('rejects closing a lot while leaving cost-basis dust', () => {
      const [lot] = fxCostBasisLotEntity.make(validPayload);

      expect(() =>
        fxCostBasisLotEntity.consume(
          lot,
          lot.remainingQuantity,
          moneyValue.make(149999, SYSTEM_CURRENCIES.NGN, false)
        )
      ).toThrow(fxCostBasisLotError.InvalidConsumptionCostBasis);
    });
  });

  describe('reverseAcquisition', () => {
    it('keeps a partially reversed lot open', () => {
      const [lot] = fxCostBasisLotEntity.make(validPayload);

      const [updated] = fxCostBasisLotEntity.reverseAcquisition(
        lot,
        moneyValue.make(40, SYSTEM_CURRENCIES.USD, false),
        moneyValue.make(60000, SYSTEM_CURRENCIES.NGN, false)
      );

      expect(updated.status).toBe(EFxCostBasisLotStatus.Open);
    });

    it('reverses an acquisition and can close the lot', () => {
      const [lot] = fxCostBasisLotEntity.make(validPayload);

      const [updated, events, audit] = fxCostBasisLotEntity.reverseAcquisition(
        lot,
        lot.remainingQuantity,
        lot.remainingCostBasis
      );

      expect(updated.status).toBe(EFxCostBasisLotStatus.Closed);
      expect(updated.version).toBe(2);
      expect(events[0].type).toBe(EFxCostBasisLotEvent.Reversed);
      expect(audit.action).toBe(EFxCostBasisLotAuditAction.Reversed);
    });
  });

  describe('reverseDisposition', () => {
    it('restores a disposed lot to an open state', () => {
      const [lot] = fxCostBasisLotEntity.make({
        ...validPayload,
        remainingQuantity: moneyValue.make(60, SYSTEM_CURRENCIES.USD, false),
        remainingCostBasis: moneyValue.make(
          90000,
          SYSTEM_CURRENCIES.NGN,
          false
        ),
      });

      const [updated, events, audit] = fxCostBasisLotEntity.reverseDisposition(
        lot,
        moneyValue.make(40, SYSTEM_CURRENCIES.USD, false),
        moneyValue.make(60000, SYSTEM_CURRENCIES.NGN, false)
      );

      expect(updated.status).toBe(EFxCostBasisLotStatus.Open);
      expect(updated.remainingQuantity).toEqual(validPayload.originalQuantity);
      expect(updated.remainingCostBasis).toEqual(validPayload.costBasis);
      expect(events[0].type).toBe(EFxCostBasisLotEvent.Reversed);
      expect(audit.action).toBe(EFxCostBasisLotAuditAction.Reversed);
    });
  });

  describe('helpers', () => {
    it('validates status', () => {
      expect(lotValidation.isValidStatus(EFxCostBasisLotStatus.Open)).toBe(
        true
      );
      expect(lotValidation.isValidStatus(EFxCostBasisLotStatus.Closed)).toBe(
        true
      );
      expect(lotValidation.isValidStatus('invalid-status')).toBe(false);
      expect(() =>
        lotValidation.validateStatus(EFxCostBasisLotStatus.Open)
      ).not.toThrow();
      expect(() => lotValidation.validateStatus('invalid-status')).toThrow(
        fxCostBasisLotError.InvalidStatus
      );
    });

    it('validates money shape', () => {
      expect(lotValidation.isValidMoney(validPayload.originalQuantity)).toBe(
        true
      );
      expect(
        lotValidation.isValidMoney({
          amount: 100n,
          currency: { ...SYSTEM_CURRENCIES.USD, code: 'INVALID' },
        })
      ).toBe(false);
    });

    it('validates quantity values and invariants', () => {
      expect(() =>
        lotValidation.validateQuantity(
          validPayload.originalQuantity,
          validPayload.remainingQuantity
        )
      ).not.toThrow();
      expect(() =>
        lotValidation.validateQuantity(
          moneyValue.make(0, SYSTEM_CURRENCIES.USD, false),
          validPayload.remainingQuantity
        )
      ).toThrow(fxCostBasisLotError.InvalidOriginalQuantity);
      expect(() =>
        lotValidation.validateQuantity(
          validPayload.originalQuantity,
          moneyValue.make(0, SYSTEM_CURRENCIES.USD, false)
        )
      ).not.toThrow();
      expect(() =>
        lotValidation.validateQuantity(validPayload.originalQuantity, {
          ...validPayload.remainingQuantity,
          amount: -1n,
        })
      ).toThrow(fxCostBasisLotError.InvalidRemainingQuantity);
      expect(() =>
        lotValidation.validateQuantity(
          validPayload.originalQuantity,
          moneyValue.make(100, SYSTEM_CURRENCIES.EUR, false)
        )
      ).toThrow(fxCostBasisLotError.MismatchedQuantityCurrency);
      expect(() =>
        lotValidation.validateQuantity(
          validPayload.originalQuantity,
          moneyValue.make(101, SYSTEM_CURRENCIES.USD, false)
        )
      ).toThrow(fxCostBasisLotError.ExcessRemainingQuantity);
    });

    it('validates cost basis values and invariants', () => {
      expect(() =>
        lotValidation.validateCostBasis(
          validPayload.costBasis,
          validPayload.remainingCostBasis
        )
      ).not.toThrow();
      expect(() =>
        lotValidation.validateCostBasis(
          moneyValue.make(0, SYSTEM_CURRENCIES.NGN, false),
          validPayload.remainingCostBasis
        )
      ).toThrow(fxCostBasisLotError.InvalidCostBasis);
      expect(() =>
        lotValidation.validateCostBasis(
          validPayload.costBasis,
          moneyValue.make(0, SYSTEM_CURRENCIES.NGN, false)
        )
      ).not.toThrow();
      expect(() =>
        lotValidation.validateCostBasis(validPayload.costBasis, {
          ...validPayload.remainingCostBasis,
          amount: -1n,
        })
      ).toThrow(fxCostBasisLotError.InvalidRemainingCostBasis);
      expect(() =>
        lotValidation.validateCostBasis(
          validPayload.costBasis,
          moneyValue.make(150000, SYSTEM_CURRENCIES.USD, false)
        )
      ).toThrow(fxCostBasisLotError.MismatchedCostBasisCurrency);
      expect(() =>
        lotValidation.validateCostBasis(
          validPayload.costBasis,
          moneyValue.make(150001, SYSTEM_CURRENCIES.NGN, false)
        )
      ).toThrow(fxCostBasisLotError.ExcessRemainingCostBasis);
    });
  });
});
