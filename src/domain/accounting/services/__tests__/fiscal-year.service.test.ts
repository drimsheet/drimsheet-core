import generateUUID from '@shared/utils/uuid-generator';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import periodError from '@domain/accounting/errors/period.error';
import IFiscalYearRepo from '@domain/accounting/repos/fiscal-year.repo';
import makeFiscalYearService from '@domain/accounting/services/fiscal-year.service';
import { IFiscalYear } from '@domain/accounting/types/fiscal-year.types';
import {
  EPeriodStatus,
  UPeriodStatus,
} from '@domain/accounting/types/period.types';

describe('fiscalYearService.create', () => {
  const createdBy = generateUUID();
  const accountingEntity = accountingEntityEntity.make({
    createdBy,
    ownerId: generateUUID(),
    name: 'Business',
    type: 'sole_trader',
    functionalCurrencyCode: 'NGN',
    jurisdictionCode: 'NG',
  })[0];
  const input = {
    accountingEntity,
    createdBy,
    name: 'FY 2027',
    startDate: new Date('2027-01-01'),
    endDate: new Date('2027-12-31'),
    status: EPeriodStatus.Open,
  };
  const repo: jest.Mocked<IFiscalYearRepo> = {
    findByAccountingEntityId: jest.fn(),
    findByIdAndAccountingEntityId: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    existsByRange: jest.fn(),
  };
  const service = makeFiscalYearService({ fiscalYearRepo: repo });
  const options = { correlationId: 'fiscal-year-test' };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01'));
    jest.resetAllMocks();
    repo.existsByRange.mockResolvedValue(false);
  });
  afterEach(() => jest.useRealTimers());

  it.each(Object.values(EPeriodStatus))(
    'prepares the initial year with valid status %s without changing dates',
    async (status) => {
      const [year, events, audit] = await service.create(
        { ...input, status },
        options
      );
      expect(year).toMatchObject({
        accountingEntityId: accountingEntity.id,
        createdBy,
        name: input.name,
        status,
        startDate: input.startDate,
        endDate: input.endDate,
      });
      expect(Object.isFrozen(year)).toBe(true);
      expect(events).toHaveLength(1);
      expect(events[0].data).toEqual(year);
      expect(audit.diff).toEqual({ before: null, after: year });
      expect(repo.existsByRange).toHaveBeenCalledWith(
        accountingEntity.id,
        { startDate: input.startDate, endDate: input.endDate },
        options
      );
      expect(repo.create).not.toHaveBeenCalled();
    }
  );

  it('derives a name when omitted', async () => {
    expect(
      (await service.create({ ...input, name: undefined }, options))[0].name
    ).toBe('2027');
  });

  it.each([
    { startDate: new Date('invalid') },
    { endDate: new Date('invalid') },
    { startDate: new Date('2028-01-01') },
    { endDate: new Date('2027-01-15') },
  ])(
    'rejects invalid date configuration %j before querying overlap',
    async (change) => {
      await expect(
        service.create({ ...input, ...change }, options)
      ).rejects.toBeInstanceOf(periodError.InvalidDateRange);
      expect(repo.existsByRange).not.toHaveBeenCalled();
    }
  );

  it('preserves the existing rejection of years ending in the past', async () => {
    await expect(
      service.create(
        {
          ...input,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
        },
        options
      )
    ).rejects.toBeInstanceOf(periodError.PastEndDate);
  });

  it('rejects invalid status in the domain', async () => {
    await expect(
      service.create({ ...input, status: 'invalid' as UPeriodStatus }, options)
    ).rejects.toBeInstanceOf(periodError.InvalidStatus);
    expect(repo.existsByRange).not.toHaveBeenCalled();
  });

  it('accepts the configured duration limit and rejects dates beyond it', async () => {
    await expect(
      service.create({ ...input, endDate: new Date('2028-07-01') }, options)
    ).resolves.toBeDefined();
    await expect(
      service.create({ ...input, endDate: new Date('2028-07-02') }, options)
    ).rejects.toBeInstanceOf(periodError.FiscalYearExceedsJurisdictionLimit);
    expect(repo.existsByRange).toHaveBeenCalledTimes(1);
    expect(input.endDate).toEqual(new Date('2027-12-31'));
  });

  describe('ACC-FY-005: non-overlapping annual cycles', () => {
    let stored: IFiscalYear[];
    beforeEach(() => {
      stored = [
        fiscalYearEntity.make({
          createdBy,
          accountingEntityId: accountingEntity.id,
          startDate: new Date('2027-01-01'),
          endDate: new Date('2027-12-31'),
          status: EPeriodStatus.Closed,
        })[0],
      ];
      repo.existsByRange.mockImplementation(async (id, range) =>
        stored.some(
          (year) =>
            year.accountingEntityId === id &&
            year.startDate <= range.endDate &&
            year.endDate >= range.startDate
        )
      );
    });

    it.each([
      ['identical', '2027-01-01', '2027-12-31'],
      ['contained', '2027-03-01', '2027-08-31'],
      ['containing', '2026-12-01', '2028-01-01'],
      ['overlapping start', '2026-12-01', '2027-02-01'],
      ['overlapping end', '2027-11-01', '2028-02-01'],
      ['shared start boundary', '2026-01-01', '2027-01-01'],
      ['shared end boundary', '2027-12-31', '2028-12-31'],
    ])(
      'rejects %s even when the existing year is closed',
      async (_label, start, end) => {
        await expect(
          service.create(
            { ...input, startDate: new Date(start), endDate: new Date(end) },
            options
          )
        ).rejects.toBeInstanceOf(periodError.OverlappingFiscalYears);
      }
    );

    it.each([
      ['before', '2026-01-01', '2026-12-31'],
      ['after', '2028-01-01', '2028-12-31'],
    ])(
      'accepts a distinct adjacent year %s the existing cycle',
      async (_label, start, end) => {
        const [year] = await service.create(
          { ...input, startDate: new Date(start), endDate: new Date(end) },
          options
        );
        expect(year.accountingEntityId).toBe(accountingEntity.id);
      }
    );

    it('allows matching dates for a different entity', async () => {
      stored = [];
      const otherEntity = accountingEntityEntity.make({
        createdBy,
        ownerId: generateUUID(),
        name: 'Other',
        type: 'sole_trader',
        jurisdictionCode: 'NG',
        functionalCurrencyCode: 'NGN',
      })[0];
      stored.push(
        fiscalYearEntity.make({
          ...input,
          accountingEntityId: otherEntity.id,
        })[0]
      );
      await expect(service.create(input, options)).resolves.toBeDefined();
    });
  });
});
