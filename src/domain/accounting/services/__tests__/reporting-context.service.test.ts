import generateUUID from '@shared/utils/uuid-generator';

import { UAccountingStandardCode } from '@domain/accounting/config/accounting-standards.config';
import accountingContextEntity from '@domain/accounting/entities/accounting-context.entity';
import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import reportingContextEntity from '@domain/accounting/entities/reporting-context.entity';
import reportingPeriodEntity from '@domain/accounting/entities/reporting-period.entity';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import accountingStandardError from '@domain/accounting/errors/accounting-standard.error';
import accountingError from '@domain/accounting/errors/accounting.error';
import { EReportingContextEvents } from '@domain/accounting/events/reporting-context.events';
import IAccountingContextRepo from '@domain/accounting/repos/accounting-context.repo';
import IReportingContextRepo from '@domain/accounting/repos/reporting-context.repo';
import IReportingPeriodRepo from '@domain/accounting/repos/reporting-period.repo';
import makeReportingContextService from '@domain/accounting/services/reporting-context.service';
import { UCurrencyCode } from '@domain/money/config/currencies.config';
import currencyError from '@domain/money/errors/currency.error';

describe('reportingContextService', () => {
  const createdBy = generateUUID();
  const accountingEntity = accountingEntityEntity.make({
    createdBy,
    ownerId: generateUUID(),
    name: 'Business',
    type: 'private_company',
    functionalCurrencyCode: 'NGN',
    jurisdictionCode: 'NG',
  })[0];
  const reportingContextRepo: jest.Mocked<IReportingContextRepo> = {
    findById: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    deleteByAccountingEntityId: jest.fn(),
  };
  const accountingContextRepo: jest.Mocked<IAccountingContextRepo> = {
    findById: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    deleteByAccountingEntityId: jest.fn(),
  };
  const reportingPeriodRepo: jest.Mocked<IReportingPeriodRepo> = {
    findById: jest.fn(),
    findAllByFiscalYear: jest.fn(),
    create: jest.fn(),
  };
  const service = makeReportingContextService({
    reportingContextRepo,
    accountingContextRepo,
    reportingPeriodRepo,
  });

  function makeInput(yearNumber = 2026) {
    jest.setSystemTime(new Date(`${yearNumber}-01-01`));
    const fiscalYear = fiscalYearEntity.make({
      accountingEntityId: accountingEntity.id,
      createdBy,
      startDate: new Date(`${yearNumber}-01-01`),
      endDate: new Date(`${yearNumber}-12-31`),
      status: 'open',
    })[0];
    const reportingPeriods = reportingPeriodEntity
      .make({
        accountingEntityId: accountingEntity.id,
        createdBy,
        fiscalYear,
        unit: 'quarter',
        count: 4,
      })
      .map(([period]) => period);
    const reportingPeriod = reportingPeriods[0];
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
      reportingPeriods,
      createdBy,
      name: 'Reporting context',
      description: null,
      accountingStandardCode: 'IFRS' as const,
      reportingCurrencyCode: 'USD' as const,
    };
  }

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-10-19'));
  });
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
  describe('updateCurrentReportingPeriod', () => {
    const options = { correlationId: 'reporting-transition' };
    function prepare() {
      const input = makeInput();
      const [context] = service.create(input);
      reportingContextRepo.findById.mockResolvedValue(context);
      accountingContextRepo.findById.mockResolvedValue(input.accountingContext);
      reportingPeriodRepo.findById.mockImplementation(
        async (id) =>
          input.reportingPeriods.find((period) => period.id === id) ?? null
      );
      const transition = {
        reportingContextId: context.id,
        previousState: {
          currentReportingPeriod: input.reportingPeriods[0].id,
          nextReportingPeriod: input.reportingPeriods[1].id,
        },
      };
      return { input, context, transition };
    }

    it('advances to the adjacent period and returns an event and audit', async () => {
      const { context, transition, input } = prepare();
      const [updated, events, audit] =
        await service.updateCurrentReportingPeriod(transition, options);
      expect(updated.currentReportingPeriodId).toBe(
        input.reportingPeriods[1].id
      );
      expect(context.currentReportingPeriodId).toBe(
        input.reportingPeriods[0].id
      );
      expect(events[0]).toMatchObject({
        type: EReportingContextEvents.Updated,
        data: updated,
      });
      expect(audit?.diff).toEqual({ before: context, after: updated });
      expect(reportingContextRepo.findById).toHaveBeenCalledWith(
        context.id,
        options
      );
      expect(accountingContextRepo.findById).toHaveBeenCalledWith(
        context.accountingContextId,
        options
      );
      expect(reportingPeriodRepo.findById).toHaveBeenNthCalledWith(
        1,
        transition.previousState.currentReportingPeriod,
        options
      );
      expect(reportingPeriodRepo.findById).toHaveBeenNthCalledWith(
        2,
        transition.previousState.nextReportingPeriod,
        options
      );
      expect(reportingContextRepo.update).not.toHaveBeenCalled();
    });

    it('returns the original context without events or audit on repeated delivery', async () => {
      const { context, transition } = prepare();
      const [updated] = reportingContextEntity.update(context, {
        currentReportingPeriodId: transition.previousState.nextReportingPeriod,
      });
      reportingContextRepo.findById.mockResolvedValue(updated);
      const result = await service.updateCurrentReportingPeriod(
        transition,
        options
      );
      expect(result[0]).toBe(updated);
      expect(result.slice(1)).toEqual([[], null]);
    });

    it('rejects a missing reporting context', async () => {
      const { transition } = prepare();
      reportingContextRepo.findById.mockResolvedValue(null);
      await expect(
        service.updateCurrentReportingPeriod(transition, options)
      ).rejects.toThrow(accountingError.ReportingContextNotFound);
    });

    it('rejects a missing accounting context', async () => {
      const { transition } = prepare();
      accountingContextRepo.findById.mockResolvedValue(null);
      await expect(
        service.updateCurrentReportingPeriod(transition, options)
      ).rejects.toThrow(accountingError.AccountingContextNotFound);
    });

    it.each(['currentReportingPeriod', 'nextReportingPeriod'] as const)(
      'rejects a missing %s',
      async (field) => {
        const { transition } = prepare();
        transition.previousState[field] = generateUUID();
        await expect(
          service.updateCurrentReportingPeriod(transition, options)
        ).rejects.toThrow(
          field === 'currentReportingPeriod'
            ? accountingError.InvalidCurrentReportingPeriodId
            : accountingError.InvalidNextReportingPeriodId
        );
      }
    );

    it.each([0, 1])(
      'rejects foreign ownership for period %s',
      async (index) => {
        const { input, transition } = prepare();
        reportingPeriodRepo.findById.mockImplementation(async (id) => {
          const period = input.reportingPeriods.find(
            (period) => period.id === id
          )!;
          return period.id === input.reportingPeriods[index].id
            ? { ...period, accountingEntityId: generateUUID() }
            : period;
        });
        await expect(
          service.updateCurrentReportingPeriod(transition, options)
        ).rejects.toThrow(accountingError.InvalidCurrentReportingPeriodId);
      }
    );

    it('rejects a skipped period', async () => {
      const { input, transition } = prepare();
      transition.previousState.nextReportingPeriod =
        input.reportingPeriods[2].id;
      await expect(
        service.updateCurrentReportingPeriod(transition, options)
      ).rejects.toThrow(accountingError.InvalidNextReportingPeriodId);
    });

    it('rejects a stale transition after the context advances again', async () => {
      const { input, context, transition } = prepare();
      const [advanced] = reportingContextEntity.update(context, {
        currentReportingPeriodId: input.reportingPeriods[2].id,
      });
      reportingContextRepo.findById.mockResolvedValue(advanced);
      await expect(
        service.updateCurrentReportingPeriod(transition, options)
      ).rejects.toThrow(accountingError.InvalidCurrentReportingPeriodId);
    });

    it('propagates repository failures', async () => {
      const { transition } = prepare();
      const failure = new Error('Read failed');
      reportingContextRepo.findById.mockRejectedValue(failure);
      await expect(
        service.updateCurrentReportingPeriod(transition, options)
      ).rejects.toBe(failure);
    });
  });
});
