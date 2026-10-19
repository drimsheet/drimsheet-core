import generateUUID from '@shared/utils/uuid-generator';

import { UAccountingStandardCode } from '@domain/accounting/config/accounting-standards.config';
import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import accountingPeriodEntity from '@domain/accounting/entities/accounting-period.entity';
import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import accountingStandardError from '@domain/accounting/errors/accounting-standard.error';
import accountingError from '@domain/accounting/errors/accounting.error';
import makeAccountingContextService from '@domain/accounting/services/accounting-context.service';
import { EPeriodStatus } from '@domain/accounting/types/period.types';

describe('accountingContextService.create', () => {
  const createdBy = generateUUID();
  const accountingEntity = accountingEntityEntity.make({
    createdBy,
    ownerId: generateUUID(),
    name: 'Business',
    type: 'private_company',
    functionalCurrencyCode: 'NGN',
    jurisdictionCode: 'NG',
  })[0];
  const service = makeAccountingContextService();

  function makeInput(yearNumber = 2026) {
    jest.setSystemTime(new Date(`${yearNumber}-01-01`));
    const fiscalYear = fiscalYearEntity.make({
      accountingEntityId: accountingEntity.id,
      createdBy,
      startDate: new Date(`${yearNumber}-01-01`),
      endDate: new Date(`${yearNumber}-12-31`),
      status: 'open',
    })[0];
    const accountingPeriod = accountingPeriodEntity.make({
      accountingEntityId: accountingEntity.id,
      createdBy,
      fiscalYear,
      unit: 'month',
      count: 12,
    })[3][0];
    jest.setSystemTime(new Date('2026-10-17'));
    return {
      accountingEntity,
      fiscalYear,
      accountingPeriod,
      createdBy,
      name: 'Working context',
      description: null,
      accountingStandardCode: 'IFRS' as const,
    };
  }

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('rejects context creation for an archived accounting entity', () => {
    const input = makeInput();
    const [archivedEntity] = accountingEntityEntity.archive(
      input.accountingEntity
    );
    expect(() =>
      service.create({ ...input, accountingEntity: archivedEntity })
    ).toThrow(accountingEntityError.Archived);
  });

  it.each([2025, 2026, 2027])(
    'creates a valid context for year %s with the explicit selection and its event/audit',
    (yearNumber) => {
      const input = makeInput(yearNumber);
      const [context, events, audit] = service.create(input);
      expect(context).toMatchObject({
        accountingEntityId: accountingEntity.id,
        fiscalYearId: input.fiscalYear.id,
        currentAccountingPeriodId: input.accountingPeriod.id,
        accountingStandardCode: 'IFRS',
        createdBy,
        name: input.name,
        description: null,
        closedAt: null,
      });
      expect(Object.isFrozen(service)).toBe(true);
      expect(Object.isFrozen(context)).toBe(true);
      expect(events).toHaveLength(1);
      expect(events[0].data).toEqual(context);
      expect(audit.diff).toEqual({ before: null, after: context });
    }
  );

  it('rejects a fiscal year belonging to another entity', () => {
    const input = makeInput();
    expect(() =>
      service.create({
        ...input,
        fiscalYear: { ...input.fiscalYear, accountingEntityId: generateUUID() },
      })
    ).toThrow(accountingError.InvalidFiscalYearId);
  });

  it.each(['accountingEntityId', 'fiscalYearId'] as const)(
    'rejects a selected period with a different %s',
    (field) => {
      const input = makeInput();
      expect(() =>
        service.create({
          ...input,
          accountingPeriod: {
            ...input.accountingPeriod,
            [field]: generateUUID(),
          },
        })
      ).toThrow(accountingError.InvalidCurrentAccountingPeriodId);
    }
  );

  it.each(['UNKNOWN', 'US_GAAP', 'CASH_BASIS'])(
    'rejects an unrecognized or impermissible standard %s inside the domain',
    (accountingStandardCode) => {
      expect(() =>
        service.create({
          ...makeInput(),
          accountingStandardCode:
            accountingStandardCode as UAccountingStandardCode,
        })
      ).toThrow(accountingStandardError.Invalid);
    }
  );

  it.each(Object.values(EPeriodStatus))(
    'preserves period status %s when selecting it',
    (status) => {
      const input = makeInput();
      const accountingPeriod = Object.freeze({
        ...input.accountingPeriod,
        status,
      });
      const before = JSON.stringify(accountingPeriod);
      const [context] = service.create({ ...input, accountingPeriod });
      expect(context.currentAccountingPeriodId).toBe(accountingPeriod.id);
      expect(JSON.stringify(accountingPeriod)).toBe(before);
    }
  );

  it('enforces entity field validity as part of domain creation', () => {
    expect(() => service.create({ ...makeInput(), name: '' })).toThrow(
      accountingError.InvalidName
    );
  });
});
