import generateUUID from '@shared/utils/uuid-generator';

import accountingContextEntity from '@domain/accounting/entities/accounting-context.entity';
import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import reportingIntervalEntity from '@domain/accounting/entities/reporting-interval.entity';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import accountingError from '@domain/accounting/errors/accounting.error';
import { EReportingContextEvents } from '@domain/accounting/events/reporting-context.events';
import IAccountingContextRepo from '@domain/accounting/repos/accounting-context.repo';
import IReportingContextRepo from '@domain/accounting/repos/reporting-context.repo';
import makeReportingContextService from '@domain/accounting/services/reporting-context.service';
import { UCurrencyCode } from '@domain/money/config/currencies.config';
import currencyError from '@domain/money/errors/currency.error';

describe('reporting context creation with an interval', () => {
  const repoOptions = { correlationId: 'reporting-context-create' };
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
    existsByAccountingContext: jest.fn(),
    findByFiscalYear: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    deleteByAccountingEntityId: jest.fn(),
  };
  const accountingContextRepo: jest.Mocked<IAccountingContextRepo> = {
    existsByFiscalYear: jest.fn(),
    findByFiscalYear: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    deleteByAccountingEntityId: jest.fn(),
  };
  const reportingPeriodRepo = {
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
    const [reportingInterval] = reportingIntervalEntity.make(
      {
        accountingEntityId: accountingEntity.id,
        createdBy,
        fiscalYearId: fiscalYear.id,
        startDate: fiscalYear.startDate,
        endDate: new Date(`${yearNumber + 1}-01-01`),
        unit: 'quarter',
        count: 4,
        periods: Array.from({ length: 4 }, (_, index) => ({
          name: `Quarter ${index + 1}`,
        })),
      },
      new Date('2026-10-19')
    );
    const accountingContext = accountingContextEntity.make({
      accountingEntityId: accountingEntity.id,
      fiscalYearId: fiscalYear.id,
      accountingIntervalId: generateUUID(),
      accountingStandardCode: 'IFRS',
      createdBy,
      name: 'Accounting context',
      description: null,
    })[0];
    jest.setSystemTime(new Date('2026-10-19'));
    return {
      accountingEntity,
      accountingContext,
      reportingInterval,
      createdBy,
      name: 'Reporting context',
      description: null,
      reportingCurrencyCode: 'USD' as const,
    };
  }

  beforeEach(() => {
    jest.resetAllMocks();
    reportingContextRepo.existsByAccountingContext.mockResolvedValue(false);
    jest.useFakeTimers().setSystemTime(new Date('2026-10-19'));
  });
  afterEach(() => jest.useRealTimers());

  it.each([null, new Date('2026-12-31')])(
    'rejects a duplicate reporting context, closedAt=%s (ACC-RC-006)',
    async (closedAt) => {
      const input = makeInput();
      const [existing] = await service.create(input, repoOptions);
      const stored = { ...existing, closedAt };
      reportingContextRepo.existsByAccountingContext.mockImplementation(
        async (id) => stored.accountingContextId === id
      );
      await expect(service.create(input, repoOptions)).rejects.toThrow(
        accountingError.ReportingContextAlreadyExists
      );
      expect(
        reportingContextRepo.existsByAccountingContext
      ).toHaveBeenLastCalledWith(input.accountingContext.id, repoOptions);
      expect(reportingContextRepo.create).not.toHaveBeenCalled();
    }
  );

  it('permits reporting for a different fiscal year and accounting context', async () => {
    const [existing] = await service.create(makeInput(2025), repoOptions);
    reportingContextRepo.existsByAccountingContext.mockImplementation(
      async (id) => existing.accountingContextId === id
    );
    const input = makeInput(2026);
    await expect(service.create(input, repoOptions)).resolves.toEqual([
      expect.objectContaining({
        accountingContextId: input.accountingContext.id,
      }),
      expect.any(Array),
      expect.any(Object),
    ]);
  });

  it('propagates uniqueness lookup failures without persisting', async () => {
    const failure = new Error('Lookup failed');
    reportingContextRepo.existsByAccountingContext.mockRejectedValue(failure);
    await expect(service.create(makeInput(), repoOptions)).rejects.toBe(
      failure
    );
    expect(reportingContextRepo.create).not.toHaveBeenCalled();
  });

  it.each([2025, 2026, 2027])(
    'creates a context for year %s with an explicit interval, event, and audit',
    async (yearNumber) => {
      const input = makeInput(yearNumber);
      const before = JSON.stringify(input);
      const [context, events, audit] = await service.create(input, repoOptions);
      expect(context).toEqual({
        id: expect.any(String),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        accountingEntityId: accountingEntity.id,
        accountingContextId: input.accountingContext.id,
        reportingIntervalId: input.reportingInterval.id,
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
      expect(reportingPeriodRepo.findById).not.toHaveBeenCalled();
      expect(reportingContextRepo.create).not.toHaveBeenCalled();
      expect(reportingPeriodRepo.create).not.toHaveBeenCalled();
      expect(accountingContextRepo.create).not.toHaveBeenCalled();
    }
  );

  it('rejects an archived entity', async () => {
    const input = makeInput();
    const [archivedEntity] = accountingEntityEntity.archive(accountingEntity);
    await expect(
      service.create(
        { ...input, accountingEntity: archivedEntity },
        repoOptions
      )
    ).rejects.toThrow(accountingEntityError.Archived);
  });

  it('rejects a context owned by another entity (ACC-RC-001)', async () => {
    const input = makeInput();
    const [foreignContext] = accountingContextEntity.make({
      ...input.accountingContext,
      accountingEntityId: generateUUID(),
    });
    await expect(
      service.create(
        { ...input, accountingContext: foreignContext },
        repoOptions
      )
    ).rejects.toThrow(accountingError.InvalidAccountingContextId);
  });

  it.each(['accountingEntityId', 'fiscalYearId'] as const)(
    'rejects a reporting interval with a different %s (ACC-RC-002)',
    async (field) => {
      const input = makeInput();
      await expect(
        service.create(
          {
            ...input,
            reportingInterval: {
              ...input.reportingInterval,
              [field]: generateUUID(),
            },
          },
          repoOptions
        )
      ).rejects.toThrow(accountingError.InvalidReportingIntervalId);
    }
  );

  it('rejects an unknown reporting currency inside the domain (ACC-RC-004)', async () => {
    await expect(
      service.create(
        {
          ...makeInput(),
          reportingCurrencyCode: 'UNKNOWN' as UCurrencyCode,
        },
        repoOptions
      )
    ).rejects.toThrow(currencyError.InvalidCode);
  });

  it('enforces context field validity during creation', async () => {
    await expect(
      service.create({ ...makeInput(), name: '' }, repoOptions)
    ).rejects.toThrow(accountingError.InvalidName);
  });
});
