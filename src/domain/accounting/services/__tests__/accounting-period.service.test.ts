import { TEntityId } from '@shared/types/uuid';

import accountingIntervalEntity from '@domain/accounting/entities/accounting-interval.entity';
import periodError from '@domain/accounting/errors/period.error';
import IAccountingPeriodRepo from '@domain/accounting/repos/accounting-period.repo';
import makeAccountingPeriodService from '@domain/accounting/services/accounting-period.service';
import { EAccountingPeriodStatus } from '@domain/accounting/types/accounting-period.types';

const accountingEntityId = '98402eb7-ec79-436f-b258-00a4fb9a572a' as TEntityId;
const createdBy = 'a1111111-1111-4111-8111-111111111111' as TEntityId;
const repoOptions = { correlationId: 'period-test' };
const repo: jest.Mocked<IAccountingPeriodRepo> = {
  findAllByFiscalYear: jest.fn(),
  findById: jest.fn(),
  findByDate: jest.fn(),
  findAllByDate: jest.fn(),
  findByRange: jest.fn(),
  create: jest.fn(),
};
const service = makeAccountingPeriodService({ accountingPeriodRepo: repo });

function makeInterval() {
  const [interval] = accountingIntervalEntity.make({
    createdBy,
    accountingEntityId,
    fiscalYearId: '98402eb7-ec79-436f-b258-00a4fb9a572b' as TEntityId,
    startDate: new Date('2028-01-01'),
    endDate: new Date('2029-01-01'),
    unit: 'month',
    count: 12,
    periods: Array.from({ length: 12 }, (_, index) => ({
      name: `Month ${index + 1}`,
    })),
  });
  return interval;
}

function makePeriod() {
  return makeInterval().periods[0];
}

describe('accountingPeriodService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2027-01-01'));
    jest.resetAllMocks();
  });
  afterEach(() => jest.useRealTimers());

  describe('validatePostingPeriod', () => {
    it('accepts a single open match and passes read options through', async () => {
      const period = makePeriod();
      repo.findAllByDate.mockResolvedValue([period]);
      const date = new Date('2028-01-31');
      await expect(
        service.validatePostingPeriod(accountingEntityId, date, repoOptions)
      ).resolves.toBeUndefined();
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
      [EAccountingPeriodStatus.Open, EAccountingPeriodStatus.Closed],
      [EAccountingPeriodStatus.Closed, EAccountingPeriodStatus.Open],
      [EAccountingPeriodStatus.Open, EAccountingPeriodStatus.Open],
      [EAccountingPeriodStatus.Closed, EAccountingPeriodStatus.Closed],
    ])(
      'rejects multiple covering periods before checking status: %s then %s',
      async (firstStatus, secondStatus) => {
        const first = {
          ...makePeriod(),
          status: firstStatus,
        };
        const second = {
          ...makePeriod(),
          status: secondStatus,
        };
        repo.findAllByDate.mockResolvedValue([first, second]);

        const validation = service.validatePostingPeriod(
          accountingEntityId,
          first.startDate,
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
            postingDate: first.startDate,
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

    it.each([EAccountingPeriodStatus.Closed])('rejects %s', async (status) => {
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
      const periods = [...makeInterval().periods];
      periods[0] = { ...periods[0], status: EAccountingPeriodStatus.Closed };
      repo.findAllByDate.mockImplementation(async (id, date) =>
        periods.filter(
          (p) =>
            p.accountingEntityId === id &&
            p.startDate <= date &&
            p.endDate > date
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
      ).resolves.toBeUndefined();
      await expect(
        service.validatePostingPeriod(
          accountingEntityId,
          new Date('2028-02-29'),
          repoOptions
        )
      ).resolves.toBeUndefined();
      await expect(
        service.validatePostingPeriod(
          accountingEntityId,
          new Date('2028-12-31'),
          repoOptions
        )
      ).resolves.toBeUndefined();
      await expect(
        service.validatePostingPeriod(
          accountingEntityId,
          new Date('2029-01-01'),
          repoOptions
        )
      ).rejects.toBeInstanceOf(periodError.PostingDateNotCovered);
    });
  });
});
