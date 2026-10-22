import generateUUID from '@shared/utils/uuid-generator';

import { UAccountingStandardCode } from '@domain/accounting/config/accounting-standards.config';
import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import accountingIntervalEntity from '@domain/accounting/entities/accounting-interval.entity';
import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import accountingStandardError from '@domain/accounting/errors/accounting-standard.error';
import accountingError from '@domain/accounting/errors/accounting.error';
import makeAccountingContextService from '@domain/accounting/services/accounting-context.service';

describe('accounting context creation with an interval', () => {
  const createdBy = generateUUID();
  const accountingEntity = accountingEntityEntity.make({
    createdBy,
    ownerId: generateUUID(),
    name: 'Business',
    type: 'private_company',
    functionalCurrencyCode: 'NGN',
    jurisdictionCode: 'NG',
  })[0];
  const deps = {
    accountingContextRepo: {
      existsByFiscalYear: jest.fn(),
      findByFiscalYear: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      deleteByAccountingEntityId: jest.fn(),
      update: jest.fn(),
    },
    fiscalYearRepo: {
      findByAccountingEntityId: jest.fn(),
      findById: jest.fn(),
      existsByRange: jest.fn(),
      create: jest.fn(),
    },
    accountingPeriodRepo: {
      findAllByFiscalYear: jest.fn(),
      findById: jest.fn(),
      findByDate: jest.fn(),
      findAllByDate: jest.fn(),
      findByRange: jest.fn(),
      create: jest.fn(),
    },
  } satisfies Parameters<typeof makeAccountingContextService>[0];
  const service = makeAccountingContextService(deps);
  const options = { correlationId: 'create-context' };

  function makeInput(year = 2026) {
    jest.setSystemTime(new Date(`${year}-01-01`));
    const fiscalYear = fiscalYearEntity.make({
      accountingEntityId: accountingEntity.id,
      createdBy,
      startDate: new Date(`${year}-01-01`),
      endDate: new Date(`${year}-12-31`),
      status: 'open',
    })[0];
    const [accountingInterval] = accountingIntervalEntity.make(
      {
        accountingEntityId: accountingEntity.id,
        fiscalYearId: fiscalYear.id,
        createdBy,
        startDate: fiscalYear.startDate,
        endDate: new Date(`${year + 1}-01-01`),
        unit: 'month',
        count: 12,
        periods: Array.from({ length: 12 }, (_, index) => ({
          name: `Month ${index + 1}`,
        })),
      },
      new Date('2026-04-01')
    );
    jest.setSystemTime(new Date('2026-04-01'));
    return {
      accountingEntity,
      fiscalYear,
      accountingInterval,
      createdBy,
      name: 'Working context',
      description: null,
      accountingStandardCode: 'IFRS' as const,
    };
  }

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    deps.accountingContextRepo.existsByFiscalYear.mockResolvedValue(false);
  });

  afterEach(() => jest.useRealTimers());

  it.each([2025, 2026, 2027])(
    'prepares a context for %s without changing the interval or persisting',
    async (year) => {
      const input = makeInput(year);
      const intervalBefore = JSON.stringify(input.accountingInterval);
      const [context, events, audit] = await service.create(input, options);

      expect(context).toEqual({
        id: expect.any(String),
        accountingEntityId: accountingEntity.id,
        fiscalYearId: input.fiscalYear.id,
        accountingIntervalId: input.accountingInterval.id,
        accountingStandardCode: 'IFRS',
        createdBy,
        name: input.name,
        description: null,
        closedAt: null,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(Object.isFrozen(context)).toBe(true);
      expect(events).toHaveLength(1);
      expect(events[0].data).toBe(context);
      expect(audit.diff).toEqual({ before: null, after: context });
      expect(JSON.stringify(input.accountingInterval)).toBe(intervalBefore);
      expect(
        deps.accountingContextRepo.existsByFiscalYear
      ).toHaveBeenCalledWith(input.fiscalYear.id, options);
      expect(deps.accountingPeriodRepo.findByRange).not.toHaveBeenCalled();
      expect(deps.accountingContextRepo.create).not.toHaveBeenCalled();
      expect(deps.accountingPeriodRepo.create).not.toHaveBeenCalled();
      expect(deps.fiscalYearRepo.create).not.toHaveBeenCalled();
    }
  );

  it.each([null, new Date('2026-12-31')])(
    'rejects an existing context even when closedAt is %s (ACC-AC-005)',
    async (closedAt) => {
      const input = makeInput();
      const [existing] = await service.create(input, options);
      const stored = { ...existing, closedAt };
      deps.accountingContextRepo.existsByFiscalYear.mockImplementation(
        async (id) => stored.fiscalYearId === id
      );
      await expect(service.create(input, options)).rejects.toThrow(
        accountingError.AccountingContextAlreadyExists
      );
    }
  );

  it('rejects an archived accounting entity', async () => {
    const input = makeInput();
    const [archived] = accountingEntityEntity.archive(accountingEntity);
    await expect(
      service.create({ ...input, accountingEntity: archived }, options)
    ).rejects.toThrow(accountingEntityError.Archived);
    expect(
      deps.accountingContextRepo.existsByFiscalYear
    ).not.toHaveBeenCalled();
  });

  it('rejects a fiscal year owned by another entity (ACC-AC-001)', async () => {
    const input = makeInput();
    await expect(
      service.create(
        {
          ...input,
          fiscalYear: {
            ...input.fiscalYear,
            accountingEntityId: generateUUID(),
          },
        },
        options
      )
    ).rejects.toThrow(accountingError.InvalidFiscalYearId);
    expect(
      deps.accountingContextRepo.existsByFiscalYear
    ).not.toHaveBeenCalled();
  });

  it.each(['accountingEntityId', 'fiscalYearId'] as const)(
    'rejects an interval with a different %s (ACC-AC-002)',
    async (field) => {
      const input = makeInput();
      await expect(
        service.create(
          {
            ...input,
            accountingInterval: {
              ...input.accountingInterval,
              [field]: generateUUID(),
            },
          },
          options
        )
      ).rejects.toThrow(accountingError.InvalidAccountingIntervalId);
      expect(
        deps.accountingContextRepo.existsByFiscalYear
      ).not.toHaveBeenCalled();
    }
  );

  it.each(['UNKNOWN', 'US_GAAP', 'CASH_BASIS'])(
    'rejects an unrecognized or impermissible standard %s (ACC-AC-003/004)',
    async (code) => {
      await expect(
        service.create(
          {
            ...makeInput(),
            accountingStandardCode: code as UAccountingStandardCode,
          },
          options
        )
      ).rejects.toThrow(accountingStandardError.Invalid);
      expect(
        deps.accountingContextRepo.existsByFiscalYear
      ).not.toHaveBeenCalled();
    }
  );

  it('propagates uniqueness lookup failures', async () => {
    const failure = new Error('Lookup failed');
    deps.accountingContextRepo.existsByFiscalYear.mockRejectedValue(failure);
    await expect(service.create(makeInput(), options)).rejects.toBe(failure);
    expect(deps.accountingContextRepo.create).not.toHaveBeenCalled();
  });

  it('enforces context field validity', async () => {
    await expect(
      service.create({ ...makeInput(), name: '' }, options)
    ).rejects.toThrow(accountingError.InvalidName);
  });
});
