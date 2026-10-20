import generateUUID from '@shared/utils/uuid-generator';

import { UAccountingStandardCode } from '@domain/accounting/config/accounting-standards.config';
import accountingContextEntity from '@domain/accounting/entities/accounting-context.entity';
import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import reportingPeriodEntity from '@domain/accounting/entities/reporting-period.entity';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import accountingStandardError from '@domain/accounting/errors/accounting-standard.error';
import accountingError from '@domain/accounting/errors/accounting.error';
import { EReportingContextEvents } from '@domain/accounting/events/reporting-context.events';
import makeReportingContextService from '@domain/accounting/services/reporting-context.service';
import { UCurrencyCode } from '@domain/money/config/currencies.config';
import currencyError from '@domain/money/errors/currency.error';

describe('reportingContextService.create', () => {
  const createdBy = generateUUID();
  const accountingEntity = accountingEntityEntity.make({
    createdBy,
    ownerId: generateUUID(),
    name: 'Business',
    type: 'private_company',
    functionalCurrencyCode: 'NGN',
    jurisdictionCode: 'NG',
  })[0];
  const service = makeReportingContextService();

  function makeInput(yearNumber = 2026) {
    jest.setSystemTime(new Date(`${yearNumber}-01-01`));
    const fiscalYear = fiscalYearEntity.make({
      accountingEntityId: accountingEntity.id,
      createdBy,
      startDate: new Date(`${yearNumber}-01-01`),
      endDate: new Date(`${yearNumber}-12-31`),
      status: 'open',
    })[0];
    const reportingPeriod = reportingPeriodEntity.make({
      accountingEntityId: accountingEntity.id,
      createdBy,
      fiscalYear,
      unit: 'quarter',
      count: 4,
    })[0][0];
    const accountingContext = accountingContextEntity.make({
      accountingEntityId: accountingEntity.id,
      fiscalYearId: fiscalYear.id,
      currentAccountingPeriodId: generateUUID(),
      previousAccountingPeriodId: null,
      nextAccountingPeriodId: null,
      accountingStandardCode: 'IFRS',
      createdBy,
      name: 'Accounting context',
      description: null,
    })[0];
    jest.setSystemTime(new Date('2026-10-19'));
    return {
      accountingEntity,
      accountingContext,
      reportingPeriod,
      createdBy,
      name: 'Reporting context',
      description: null,
      accountingStandardCode: 'IFRS' as const,
      reportingCurrencyCode: 'USD' as const,
    };
  }

  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-10-19')));
  afterEach(() => jest.useRealTimers());

  it.each([2025, 2026, 2027])(
    'creates a context for year %s with an explicit period, event, and audit',
    (yearNumber) => {
      const input = makeInput(yearNumber);
      const before = JSON.stringify(input);
      const [context, events, audit] = service.create(input);
      expect(context).toMatchObject({
        accountingEntityId: accountingEntity.id,
        accountingContextId: input.accountingContext.id,
        currentReportingPeriodId: input.reportingPeriod.id,
        accountingStandardCode: 'IFRS',
        reportingCurrencyCode: 'USD',
        createdBy,
        name: input.name,
        description: null,
        closedAt: null,
      });
      expect(Object.isFrozen(service)).toBe(true);
      expect(Object.isFrozen(context)).toBe(true);
      expect(Object.isFrozen(context.createdAt)).toBe(true);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: EReportingContextEvents.Created,
        data: context,
      });
      expect(audit.diff).toEqual({ before: null, after: context });
      expect(JSON.stringify(input)).toBe(before);
    }
  );

  it('rejects an archived entity', () => {
    const input = makeInput();
    const [archivedEntity] = accountingEntityEntity.archive(accountingEntity);
    expect(() =>
      service.create({ ...input, accountingEntity: archivedEntity })
    ).toThrow(accountingEntityError.Archived);
  });

  it('rejects a context owned by another entity (ACC-RC-001)', () => {
    const input = makeInput();
    const [foreignContext] = accountingContextEntity.make({
      ...input.accountingContext,
      accountingEntityId: generateUUID(),
    });
    expect(() =>
      service.create({ ...input, accountingContext: foreignContext })
    ).toThrow(accountingError.InvalidAccountingContextId);
  });

  it.each(['accountingEntityId', 'fiscalYearId'] as const)(
    'rejects a reporting period with a different %s (ACC-RC-002)',
    (field) => {
      const input = makeInput();
      expect(() =>
        service.create({
          ...input,
          reportingPeriod: {
            ...input.reportingPeriod,
            [field]: generateUUID(),
          },
        })
      ).toThrow(accountingError.InvalidCurrentReportingPeriodId);
    }
  );

  it('allows a recognized reporting standard different from the accounting standard (ACC-RC-003)', () => {
    const input = makeInput();
    const [context] = service.create({
      ...input,
      accountingStandardCode: 'US_GAAP',
    });
    expect(context.accountingStandardCode).toBe('US_GAAP');
    expect(input.accountingContext.accountingStandardCode).toBe('IFRS');
  });

  it('rejects an unknown reporting standard inside the domain (ACC-RC-003)', () => {
    expect(() =>
      service.create({
        ...makeInput(),
        accountingStandardCode: 'UNKNOWN' as UAccountingStandardCode,
      })
    ).toThrow(accountingStandardError.Invalid);
  });

  it('rejects an unknown reporting currency inside the domain (ACC-RC-004)', () => {
    expect(() =>
      service.create({
        ...makeInput(),
        reportingCurrencyCode: 'UNKNOWN' as UCurrencyCode,
      })
    ).toThrow(currencyError.InvalidCode);
  });

  it('enforces context field validity during creation', () => {
    expect(() => service.create({ ...makeInput(), name: '' })).toThrow(
      accountingError.InvalidName
    );
  });
});
