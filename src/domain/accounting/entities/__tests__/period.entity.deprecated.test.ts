import { TEntityId } from '@shared/types/uuid';

import periodEntity from '@domain/accounting/entities/period.entity.deprecated';
import periodValidation from '@domain/accounting/entities/validations/period.validation';
import periodError from '@domain/accounting/errors/period.error';
import { EPeriodActions } from '@domain/accounting/types/period-audit.types';
import {
  EPeriodStatus,
  EPeriodUnit,
  UPeriodUnit,
} from '@domain/accounting/types/period.types';

describe('periodEntity', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const validUUID = '98402eb7-ec79-436f-b258-00a4fb9a572a' as TEntityId;

  describe('validateUnit', () => {
    it('does not throw for a valid unit', () => {
      expect(() =>
        periodValidation.validateUnit(EPeriodUnit.Month)
      ).not.toThrow();
      expect(() =>
        periodValidation.validateUnit(EPeriodUnit.Quarter)
      ).not.toThrow();
    });

    it('throws InvalidPeriodUnitError if unit is invalid', () => {
      expect(() => periodValidation.validateUnit('invalid')).toThrow();
    });
  });

  describe('validateStatus', () => {
    it('does not throw for a valid status', () => {
      expect(() =>
        periodValidation.validateStatus(EPeriodStatus.Open)
      ).not.toThrow();
      expect(() =>
        periodValidation.validateStatus(EPeriodStatus.Pending)
      ).not.toThrow();
    });

    it('throws InvalidPeriodStatusError for an invalid status', () => {
      expect(() => periodValidation.validateStatus('invalid')).toThrow();
    });
  });

  describe('makeReportingPeriod', () => {
    const validPayload = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      name: 'Q1 2026',
      accountingEntityId: validUUID,
      fiscalYearId: '12302eb7-ec79-436f-b258-00a4fb9a5123' as TEntityId,
      unit: EPeriodUnit.Quarter,
      count: 1,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-03-31T23:59:59.999Z'),
    };

    it('creates a valid reporting period entity with events', () => {
      const [entity, events, audit] =
        periodEntity.makeReportingPeriod(validPayload);

      expect(entity.name).toBe(validPayload.name);
      expect(entity.accountingEntityId).toBe(validPayload.accountingEntityId);
      expect(entity.fiscalYearId).toBe(validPayload.fiscalYearId);
      expect(entity.unit).toBe(validPayload.unit);
      expect(entity.count).toBe(validPayload.count);
      expect(entity.startDate).toEqual(validPayload.startDate);
      expect(entity.endDate).toEqual(validPayload.endDate);
      expect(entity.updatedAt).toEqual(new Date('2026-04-01T00:00:00.000Z'));
      expect(entity.id).toBeDefined();

      expect(Object.isFrozen(entity)).toBe(true);

      expect(events.length).toBe(1);

      expect(audit).toEqual({
        entityId: entity.id,
        entityVersion: 1,
        action: EPeriodActions.Created,
        diff: {
          before: null,
          after: entity,
        },
        occurredAt: entity.updatedAt,
      });
      expect(Object.isFrozen(audit)).toBe(true);
    });

    it('throws AppError if accountingEntityId is invalid', () => {
      const invalidPayload = {
        ...validPayload,
        accountingEntityId: 'invalid' as TEntityId,
      };
      expect(() => periodEntity.makeReportingPeriod(invalidPayload)).toThrow(
        periodError.InvalidAccountingEntityId
      );
    });

    it('throws AppError if fiscalYearId is invalid', () => {
      const invalidPayload = {
        ...validPayload,
        fiscalYearId: 'invalid' as TEntityId,
      };
      expect(() => periodEntity.makeReportingPeriod(invalidPayload)).toThrow(
        periodError.InvalidFiscalYearId
      );
    });

    it('throws InvalidName if name is invalid', () => {
      expect(() =>
        periodEntity.makeReportingPeriod({
          ...validPayload,
          name: '',
        })
      ).toThrow(periodError.InvalidName);
    });

    it('throws InvalidCount if count is invalid', () => {
      expect(() =>
        periodEntity.makeReportingPeriod({
          ...validPayload,
          count: 0,
        })
      ).toThrow(periodError.InvalidCount);
    });

    it('throws InvalidPeriodUnitError if unit is invalid', () => {
      const invalidPayload = {
        ...validPayload,
        unit: 'invalid' as UPeriodUnit,
      };
      expect(() => periodEntity.makeReportingPeriod(invalidPayload)).toThrow();
    });
  });
});
