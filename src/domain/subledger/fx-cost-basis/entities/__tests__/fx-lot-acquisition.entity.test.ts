import { TCreationOmits } from '@shared/types/creation-omits.types';
import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';

import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import {
  EExchangeRateType,
  IExchangeRate,
} from '@domain/money/types/exchange-rate.types';
import moneyValue from '@domain/money/values/money.vo';
import fxCostBasisLotAcquisitionEntity from '@domain/subledger/fx-cost-basis/entities/acquisition.entity';
import acquisitionValidation from '@domain/subledger/fx-cost-basis/entities/validations/acquisition.validation';
import FxCostBasisLotAcquisitionError from '@domain/subledger/fx-cost-basis/errors/acquisition.error';
import { EFxCostBasisLotAcquisitionEvent } from '@domain/subledger/fx-cost-basis/events/acquisition.events';
import {
  EFxCostBasisLotAcquisitionAuditAction,
  IFxCostBasisLotAcquisition,
} from '@domain/subledger/fx-cost-basis/types/acquisition.types';

describe('fxCostBasisLotAcquisitionEntity', () => {
  const MOCK_DATE = new Date('2026-04-01T00:00:00.000Z');
  let acquisitionRate: IExchangeRate;
  let officialRate: IExchangeRate;
  let validPayload: TCreationOmits<IFxCostBasisLotAcquisition>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(MOCK_DATE);

    acquisitionRate = {
      currencyPair: 'USD/NGN',
      baseCurrencyCode: 'USD',
      targetCurrencyCode: 'NGN',
      rate: 1500,
      type: EExchangeRateType.Negotiated,
      asOf: new Date('2026-03-31T00:00:00.000Z'),
      source: 'bank',
      createdAt: new Date('2026-03-31T00:00:00.000Z'),
    };

    officialRate = {
      currencyPair: 'USD/NGN',
      baseCurrencyCode: 'USD',
      targetCurrencyCode: 'NGN',
      rate: 1490,
      type: EExchangeRateType.Official,
      asOf: new Date('2026-03-31T00:00:00.000Z'),
      source: 'central bank',
      createdAt: new Date('2026-03-31T00:00:00.000Z'),
    };

    validPayload = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      ledgerAccountId: generateUUID(),
      accountingEntityId: generateUUID(),
      lotId: generateUUID(),
      journalEntryId: generateUUID(),
      quantity: moneyValue.make(100, SYSTEM_CURRENCIES.USD, false),
      costBasis: moneyValue.make(150000, SYSTEM_CURRENCIES.NGN, false),
      acquisitionRate,
      officialRate,
      acquisitionDate: new Date('2026-03-31T00:00:00.000Z'),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('make', () => {
    it('creates a validated fx lot acquisition with event and audit', () => {
      const [entity, events, audit] =
        fxCostBasisLotAcquisitionEntity.make(validPayload);

      expect(entity.id).toBeDefined();
      expect(entity.ledgerAccountId).toBe(validPayload.ledgerAccountId);
      expect(entity.accountingEntityId).toBe(validPayload.accountingEntityId);
      expect(entity.lotId).toBe(validPayload.lotId);
      expect(entity.journalEntryId).toBe(validPayload.journalEntryId);
      expect(entity.quantity).toBe(validPayload.quantity);
      expect(entity.costBasis).toBe(validPayload.costBasis);
      expect(entity.acquisitionRate).toBe(validPayload.acquisitionRate);
      expect(entity.officialRate).toBe(validPayload.officialRate);
      expect(entity.acquisitionDate).toBe(validPayload.acquisitionDate);
      expect(entity.createdAt).toEqual(MOCK_DATE);
      expect(Object.isFrozen(entity)).toBe(true);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe(EFxCostBasisLotAcquisitionEvent.Created);
      expect(events[0].data).toEqual(entity);
      expect(events[0].occurredAt).toEqual(MOCK_DATE);

      expect(audit).toEqual({
        entityId: entity.id,
        entityVersion: 1,
        action: EFxCostBasisLotAcquisitionAuditAction.Created,
        diff: {
          before: null,
          after: entity,
        },
        occurredAt: entity.createdAt,
      });
      expect(Object.isFrozen(audit)).toBe(true);
    });

    it('allows nullable official rate fields', () => {
      const [entity] = fxCostBasisLotAcquisitionEntity.make({
        ...validPayload,
        officialRate: null,
      });

      expect(entity.journalEntryId).toBe(validPayload.journalEntryId);
      expect(entity.officialRate).toBeNull();
    });

    it('throws when id validation fails', () => {
      const invalidPayload = {
        ...validPayload,
        lotId: 'invalid-id',
      };

      expect(() =>
        // @ts-expect-error testing invalid lot id
        fxCostBasisLotAcquisitionEntity.make(invalidPayload)
      ).toThrow(FxCostBasisLotAcquisitionError.InvalidLotId);
    });

    it('throws when journal entry id validation fails', () => {
      const invalidPayload = {
        ...validPayload,
        journalEntryId: 'invalid-id',
      };

      expect(() =>
        // @ts-expect-error testing invalid journal entry id
        fxCostBasisLotAcquisitionEntity.make(invalidPayload)
      ).toThrow(FxCostBasisLotAcquisitionError.InvalidJournalEntryId);
    });

    it('throws when acquisition rate validation fails', () => {
      expect(() =>
        fxCostBasisLotAcquisitionEntity.make({
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
        fxCostBasisLotAcquisitionEntity.make({
          ...validPayload,
          acquisitionDate: new Date('2026-04-02T00:00:00.000Z'),
        })
      ).toThrow(FxCostBasisLotAcquisitionError.InvalidAcquisitionDate);
    });
  });

  describe('helpers', () => {
    it('validates money shape', () => {
      expect(acquisitionValidation.isValidMoney(validPayload.quantity)).toBe(
        true
      );
      expect(
        acquisitionValidation.isValidMoney({
          amount: 100n,
          currency: { ...SYSTEM_CURRENCIES.USD, code: 'INVALID' },
        })
      ).toBe(false);
    });

    it('validates quantity', () => {
      expect(() =>
        acquisitionValidation.validateQuantity(validPayload.quantity)
      ).not.toThrow();
      expect(() =>
        acquisitionValidation.validateQuantity(
          moneyValue.make(0, SYSTEM_CURRENCIES.USD, false)
        )
      ).toThrow(FxCostBasisLotAcquisitionError.InvalidQuantity);
    });

    it('validates cost basis', () => {
      expect(() =>
        acquisitionValidation.validateCostBasis(validPayload.costBasis)
      ).not.toThrow();
      expect(() =>
        acquisitionValidation.validateCostBasis(
          moneyValue.make(0, SYSTEM_CURRENCIES.NGN, false)
        )
      ).toThrow(FxCostBasisLotAcquisitionError.InvalidCostBasis);
    });

    it('validates official rate', () => {
      expect(() =>
        acquisitionValidation.validateOfficialRate(officialRate)
      ).not.toThrow();
      expect(() =>
        acquisitionValidation.validateOfficialRate(null)
      ).not.toThrow();
      expect(() =>
        acquisitionValidation.validateOfficialRate({
          ...officialRate,
          rate: -1,
        })
      ).toThrow();
    });
  });
});
