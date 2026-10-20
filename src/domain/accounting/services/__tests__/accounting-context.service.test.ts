import generateUUID from '@shared/utils/uuid-generator';

import { UAccountingStandardCode } from '@domain/accounting/config/accounting-standards.config';
import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import accountingPeriodEntity from '@domain/accounting/entities/accounting-period.entity';
import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import accountingStandardError from '@domain/accounting/errors/accounting-standard.error';
import accountingError from '@domain/accounting/errors/accounting.error';
import IAccountingPeriodRepo from '@domain/accounting/repos/accounting-period.repo';
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
  const repoOptions = { correlationId: 'accounting-context-test' };
  const repo: jest.Mocked<IAccountingPeriodRepo> = {
    findById: jest.fn(),
    findByDate: jest.fn(),
    findAllByDate: jest.fn(),
    findByRange: jest.fn(),
    create: jest.fn(),
  };
  const service = makeAccountingContextService({ accountingPeriodRepo: repo });

  function makeFixture(yearNumber = 2026, selectedIndex = 3, count = 12) {
    jest.setSystemTime(new Date(`${yearNumber}-01-01`));
    const fiscalYear = fiscalYearEntity.make({
      accountingEntityId: accountingEntity.id,
      createdBy,
      startDate: new Date(`${yearNumber}-01-01`),
      endDate: new Date(`${yearNumber}-12-31`),
      status: 'open',
    })[0];
    const periods = accountingPeriodEntity
      .make({
        accountingEntityId: accountingEntity.id,
        createdBy,
        fiscalYear,
        unit: count === 1 ? 'year' : 'month',
        count,
      })
      .map(([period]) => period);
    repo.findByRange.mockResolvedValue([...periods].reverse());
    jest.setSystemTime(new Date('2026-10-17'));
    const input = {
      accountingEntity,
      fiscalYear,
      accountingPeriod: periods[selectedIndex],
      createdBy,
      name: 'Working context',
      description: null,
      accountingStandardCode: 'IFRS' as const,
    };
    return { input, periods };
  }

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('rejects context creation for an archived accounting entity', async () => {
    const { input } = makeFixture();
    const [archivedEntity] = accountingEntityEntity.archive(
      input.accountingEntity
    );
    await expect(
      service.create(
        { ...input, accountingEntity: archivedEntity },
        repoOptions
      )
    ).rejects.toThrow(accountingEntityError.Archived);
  });

  it.each([2025, 2026, 2027])(
    'creates a valid context for year %s with the explicit selection and its event/audit',
    async (yearNumber) => {
      const { input, periods } = makeFixture(yearNumber);
      const [context, events, audit] = await service.create(input, repoOptions);
      expect(repo.findByRange).toHaveBeenCalledWith(
        accountingEntity.id,
        {
          startDate: input.fiscalYear.startDate,
          endDate: input.fiscalYear.endDate,
        },
        repoOptions
      );
      expect(repo.create).not.toHaveBeenCalled();
      expect(context).toMatchObject({
        accountingEntityId: accountingEntity.id,
        fiscalYearId: input.fiscalYear.id,
        currentAccountingPeriodId: input.accountingPeriod.id,
        previousAccountingPeriodId: periods[2].id,
        nextAccountingPeriodId: periods[4].id,
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

  it.each([0, 11])(
    'resolves neighbors at period index %s',
    async (selectedIndex) => {
      const { input, periods } = makeFixture(2026, selectedIndex);
      const [context] = await service.create(input, repoOptions);

      expect(context.previousAccountingPeriodId).toBe(
        selectedIndex === 0 ? null : periods[10].id
      );
      expect(context.nextAccountingPeriodId).toBe(
        selectedIndex === 0 ? periods[1].id : null
      );
    }
  );

  it('uses null for both neighbors when the fiscal year contains one period', async () => {
    const { input } = makeFixture(2026, 0, 1);
    const [context] = await service.create(input, repoOptions);

    expect(context.previousAccountingPeriodId).toBeNull();
    expect(context.nextAccountingPeriodId).toBeNull();
  });

  it('propagates a repository read failure', async () => {
    const { input } = makeFixture();
    const failure = new Error('Period lookup failed');
    repo.findByRange.mockRejectedValueOnce(failure);

    await expect(service.create(input, repoOptions)).rejects.toBe(failure);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects a selected period missing from the stored fiscal-year periods', async () => {
    const { input } = makeFixture();
    repo.findByRange.mockResolvedValueOnce([]);

    await expect(service.create(input, repoOptions)).rejects.toThrow(
      accountingError.InvalidCurrentAccountingPeriodId
    );
  });

  it('rejects a fiscal year belonging to another entity', async () => {
    const { input } = makeFixture();
    await expect(
      service.create(
        {
          ...input,
          fiscalYear: {
            ...input.fiscalYear,
            accountingEntityId: generateUUID(),
          },
        },
        repoOptions
      )
    ).rejects.toThrow(accountingError.InvalidFiscalYearId);
  });

  it.each(['accountingEntityId', 'fiscalYearId'] as const)(
    'rejects a selected period with a different %s',
    async (field) => {
      const { input } = makeFixture();
      await expect(
        service.create(
          {
            ...input,
            accountingPeriod: {
              ...input.accountingPeriod,
              [field]: generateUUID(),
            },
          },
          repoOptions
        )
      ).rejects.toThrow(accountingError.InvalidCurrentAccountingPeriodId);
    }
  );

  it.each(['UNKNOWN', 'US_GAAP', 'CASH_BASIS'])(
    'rejects an unrecognized or impermissible standard %s inside the domain',
    async (accountingStandardCode) => {
      await expect(
        service.create(
          {
            ...makeFixture().input,
            accountingStandardCode:
              accountingStandardCode as UAccountingStandardCode,
          },
          repoOptions
        )
      ).rejects.toThrow(accountingStandardError.Invalid);
    }
  );

  it.each(Object.values(EPeriodStatus))(
    'preserves period status %s when selecting it',
    async (status) => {
      const { input } = makeFixture();
      const accountingPeriod = Object.freeze({
        ...input.accountingPeriod,
        status,
      });
      const before = JSON.stringify(accountingPeriod);
      const [context] = await service.create(
        { ...input, accountingPeriod },
        repoOptions
      );
      expect(context.currentAccountingPeriodId).toBe(accountingPeriod.id);
      expect(JSON.stringify(accountingPeriod)).toBe(before);
    }
  );

  it('enforces entity field validity as part of domain creation', async () => {
    await expect(
      service.create({ ...makeFixture().input, name: '' }, repoOptions)
    ).rejects.toThrow(accountingError.InvalidName);
  });
});
