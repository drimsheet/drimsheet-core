import { TEntityId } from '@shared/types/uuid';

import accountingPeriodEntity from '@domain/accounting/entities/accounting-period.entity';
import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import periodError from '@domain/accounting/errors/period.error';
import IAccountingPeriodRepo from '@domain/accounting/repos/accounting-period.repo';
import makeAccountingPeriodService from '@domain/accounting/services/accounting-period.service';
import {
  EPeriodStatus,
  EPeriodUnit,
  UPeriodUnit,
} from '@domain/accounting/types/period.types';

const accountingEntityId = '98402eb7-ec79-436f-b258-00a4fb9a572a' as TEntityId;
const createdBy = 'a1111111-1111-4111-8111-111111111111' as TEntityId;
const repoOptions = { correlationId: 'period-test' };
const repo: jest.Mocked<IAccountingPeriodRepo> = {
  findAllByFiscalYear: jest.fn(),
  findByIdAndAccountingEntityId: jest.fn(),
  findById: jest.fn(),
  findByDate: jest.fn(),
  findAllByDate: jest.fn(),
  findByRange: jest.fn(),
  create: jest.fn(),
};
const service = makeAccountingPeriodService({ accountingPeriodRepo: repo });

function makeInput(
  start = '2028-01-01',
  end = '2028-12-31',
  unit: UPeriodUnit = EPeriodUnit.Month,
  count = 12
) {
  const [fiscalYear] = fiscalYearEntity.make({
    createdBy,
    accountingEntityId,
    startDate: new Date('2028-01-01'),
    endDate: new Date('2030-12-31'),
    status: EPeriodStatus.Open,
  });
  return {
    createdBy,
    accountingEntityId,
    unit,
    count,
    fiscalYear: {
      ...fiscalYear,
      startDate: new Date(start),
      endDate: new Date(end),
    },
  };
}

function makePeriod(start = '2028-01-01', end = '2028-01-31') {
  return accountingPeriodEntity.make(
    makeInput(start, end, EPeriodUnit.Day, 1)
  )[0][0];
}

describe('accountingPeriodService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2027-01-01'));
    jest.resetAllMocks();
    repo.findByRange.mockResolvedValue([]);
  });
  afterEach(() => jest.useRealTimers());

  describe('generate', () => {
    it('returns the entity-generated array after checking the complete fiscal-year range', async () => {
      const input = makeInput();
      const periods = await service.generate(input, repoOptions);
      expect(periods).toHaveLength(12);
      expect(periods[0][0].startDate).toEqual(input.fiscalYear.startDate);
      expect(periods[11][0].endDate).toEqual(input.fiscalYear.endDate);
      expect(repo.findByRange).toHaveBeenCalledWith(
        accountingEntityId,
        {
          startDate: input.fiscalYear.startDate,
          endDate: input.fiscalYear.endDate,
        },
        repoOptions
      );
      for (const [period, events, audit] of periods) {
        expect(events[0].data).toEqual(period);
        expect(audit.diff.after).toEqual(period);
      }
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('propagates repository failure instead of generating periods', async () => {
      const error = new Error('Lookup failed');
      repo.findByRange.mockRejectedValueOnce(error);
      await expect(service.generate(makeInput(), repoOptions)).rejects.toBe(
        error
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('rejects a stored conflict before attempting entity generation', async () => {
      repo.findByRange.mockResolvedValue([makePeriod()]);
      await expect(
        service.generate({ ...makeInput(), count: 0 }, repoOptions)
      ).rejects.toBeInstanceOf(periodError.OverlappingPeriods);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('rejects a mismatched fiscal-year owner before reading', async () => {
      const input = makeInput();
      await expect(
        service.generate(
          {
            ...input,
            fiscalYear: { ...input.fiscalYear, accountingEntityId: createdBy },
          },
          repoOptions
        )
      ).rejects.toBeInstanceOf(periodError.InvalidAccountingEntityId);
      expect(repo.findByRange).not.toHaveBeenCalled();
    });

    it.each([
      ['shared start', '2027-12-01', '2028-01-01', false],
      ['shared end', '2028-12-31', '2029-01-31', false],
      ['contained', '2028-02-01', '2028-03-01', false],
      ['enclosing', '2027-12-01', '2029-01-31', false],
      ['duplicate', '2028-01-01', '2028-12-31', false],
      ['previous day', '2027-12-01', '2027-12-31', true],
      ['following day', '2029-01-01', '2029-01-31', true],
    ] as const)(
      'checks stored overlap: %s',
      async (_label, start, end, allowed) => {
        const input = makeInput();
        const existing = makePeriod(start, end);
        repo.findByRange.mockImplementation(async (id, range) =>
          existing.accountingEntityId === id &&
          existing.startDate <= range.endDate &&
          existing.endDate >= range.startDate
            ? [existing]
            : []
        );
        if (allowed) {
          await expect(
            service.generate(input, repoOptions)
          ).resolves.toHaveLength(12);
        } else {
          await expect(
            service.generate(input, repoOptions)
          ).rejects.toBeInstanceOf(periodError.OverlappingPeriods);
        }
        expect(repo.create).not.toHaveBeenCalled();
      }
    );
  });

  describe('validatePostingPeriod', () => {
    it('returns the single open match and passes read options through', async () => {
      const period = makePeriod();
      repo.findAllByDate.mockResolvedValue([period]);
      const date = new Date('2028-01-31');
      await expect(
        service.validatePostingPeriod(accountingEntityId, date, repoOptions)
      ).resolves.toBe(period);
      expect(repo.findByDate).not.toHaveBeenCalled();
      expect(repo.findByRange).not.toHaveBeenCalled();
      expect(repo.findAllByDate).toHaveBeenCalledWith(
        accountingEntityId,
        date,
        repoOptions
      );
    });
    it('rejects a missing period', async () => {
      repo.findAllByDate.mockResolvedValue([]);
      await expect(
        service.validatePostingPeriod(
          accountingEntityId,
          new Date('2028-01-01'),
          repoOptions
        )
      ).rejects.toBeInstanceOf(periodError.PostingDateNotCovered);
    });
    it.each([
      [EPeriodStatus.Open, EPeriodStatus.Closed],
      [EPeriodStatus.Closed, EPeriodStatus.Open],
      [EPeriodStatus.Open, EPeriodStatus.Open],
      [EPeriodStatus.Closed, EPeriodStatus.Closed],
    ])(
      'rejects a shared boundary before checking status: %s then %s',
      async (firstStatus, secondStatus) => {
        const first = {
          ...makePeriod('2028-01-01', '2028-01-04'),
          status: firstStatus,
        };
        const second = {
          ...makePeriod('2028-01-04', '2028-01-07'),
          status: secondStatus,
        };
        repo.findAllByDate.mockResolvedValue([first, second]);

        const validation = service.validatePostingPeriod(
          accountingEntityId,
          first.endDate,
          repoOptions
        );
        await expect(validation).rejects.toBeInstanceOf(
          periodError.PostingPeriodAmbiguous
        );
        await expect(validation).rejects.toMatchObject({
          errorKey:
            'accounting_error_period_posting_period_ambiguous_unexpected',
          cause: {
            accountingEntityId,
            postingDate: first.endDate,
            accountingPeriodIds: [first.id, second.id],
          },
        });
      }
    );

    it('propagates posting-period lookup failure', async () => {
      const failure = new Error('Lookup failed');
      const period = makePeriod();
      repo.findAllByDate.mockRejectedValueOnce(failure);

      await expect(
        service.validatePostingPeriod(
          accountingEntityId,
          period.startDate,
          repoOptions
        )
      ).rejects.toBe(failure);
    });

    it.each([
      EPeriodStatus.Pending,
      EPeriodStatus.Closing,
      EPeriodStatus.Closed,
    ])('rejects %s', async (status) => {
      repo.findAllByDate.mockResolvedValue([{ ...makePeriod(), status }]);
      await expect(
        service.validatePostingPeriod(
          accountingEntityId,
          new Date('2028-01-01'),
          repoOptions
        )
      ).rejects.toBeInstanceOf(periodError.PostingPeriodNotOpen);
    });
    it('resolves both boundaries of adjacent periods with different statuses', async () => {
      const periods = (await service.generate(makeInput(), repoOptions)).map(
        ([p]) => p
      );
      periods[0] = { ...periods[0], status: EPeriodStatus.Closed };
      repo.findAllByDate.mockImplementation(async (id, date) =>
        periods.filter(
          (p) =>
            p.accountingEntityId === id &&
            p.startDate <= date &&
            p.endDate >= date
        )
      );
      await expect(
        service.validatePostingPeriod(
          accountingEntityId,
          new Date('2028-01-31'),
          repoOptions
        )
      ).rejects.toBeInstanceOf(periodError.PostingPeriodNotOpen);
      await expect(
        service.validatePostingPeriod(
          accountingEntityId,
          new Date('2028-02-01'),
          repoOptions
        )
      ).resolves.toEqual(periods[1]);
      await expect(
        service.validatePostingPeriod(
          accountingEntityId,
          new Date('2028-02-29'),
          repoOptions
        )
      ).resolves.toEqual(periods[1]);
      await expect(
        service.validatePostingPeriod(
          accountingEntityId,
          new Date('2028-12-31'),
          repoOptions
        )
      ).resolves.toEqual(periods[11]);
    });
  });
});
