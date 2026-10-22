import { eq, getTableColumns, SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import generateUUID from '@shared/utils/uuid-generator';

import reportingIntervalEntity from '@domain/accounting/entities/reporting-interval.entity';

import {
  reportingIntervalsInCore,
  reportingPeriodsInCore,
} from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import reportingPeriodMapper from '@infra/persistence/repos/accounting/mappers/reporting-period.mapper';
import reportingPeriodRepo from '@infra/persistence/repos/accounting/reporting-period.repo.impl';

jest.mock('@infra/persistence/helpers/get-db-query');

describe('reportingPeriodRepo reads', () => {
  const [interval] = reportingIntervalEntity.make({
    accountingEntityId: generateUUID(),
    fiscalYearId: generateUUID(),
    createdBy: generateUUID(),
    unit: 'month',
    count: 2,
    startDate: new Date('2090-01-01'),
    endDate: new Date('2090-03-01'),
    periods: [{ name: 'January' }, { name: 'February' }],
  });
  const options = { correlationId: 'read' };
  beforeEach(() => jest.resetAllMocks());

  function mockRead(found: boolean) {
    const rows = found
      ? interval.periods.map(reportingPeriodMapper.toRepo)
      : [];
    const limit = jest.fn().mockResolvedValue(rows.slice(0, 1));
    const orderBy = jest.fn().mockResolvedValue(rows);
    const where = jest.fn().mockReturnValue({ limit, orderBy });
    const innerJoin = jest.fn().mockReturnValue({ where });
    const from = jest.fn().mockReturnValue({ where, innerJoin });
    const select = jest.fn().mockReturnValue({ from });
    jest
      .mocked(getDbQuery)
      .mockReturnValue({ select } as unknown as ReturnType<typeof getDbQuery>);
    return { select, from, innerJoin, where, limit, orderBy };
  }

  it.each([true, false])(
    'loads a reporting period by ID, found=%s',
    async (found) => {
      const query = mockRead(found);
      const period = interval.periods[0];
      await expect(
        reportingPeriodRepo.findById(period.id, options)
      ).resolves.toEqual(found ? period : null);
      expect(query.where).toHaveBeenCalledWith(
        eq(reportingPeriodsInCore.id, period.id)
      );
      expect(query.limit).toHaveBeenCalledWith(1);
      expect(getDbQuery).toHaveBeenCalledWith(options);
    }
  );

  it.each([true, false])(
    'loads fiscal-year periods through their interval, found=%s',
    async (found) => {
      const query = mockRead(found);
      await expect(
        reportingPeriodRepo.findAllByFiscalYear(
          interval.accountingEntityId,
          interval.fiscalYearId,
          options
        )
      ).resolves.toEqual(found ? interval.periods : []);
      expect(query.select).toHaveBeenCalledWith(
        getTableColumns(reportingPeriodsInCore)
      );
      expect(query.innerJoin).toHaveBeenCalledWith(
        reportingIntervalsInCore,
        eq(reportingPeriodsInCore.intervalId, reportingIntervalsInCore.id)
      );
      const sql = new PgDialect().sqlToQuery(
        query.where.mock.calls[0][0] as SQL
      );
      expect(sql.params).toEqual([
        interval.accountingEntityId,
        interval.fiscalYearId,
        interval.accountingEntityId,
      ]);
      expect(sql.sql).toBe(
        '(\"core\".\"reporting_periods\".\"accounting_entity_id\" = $1 and \"core\".\"reporting_intervals\".\"fiscal_year_id\" = $2 and \"core\".\"reporting_intervals\".\"accounting_entity_id\" = $3)'
      );
      expect(query.orderBy).toHaveBeenCalledWith(
        reportingPeriodsInCore.startDate,
        reportingPeriodsInCore.id
      );
      expect(getDbQuery).toHaveBeenCalledWith(options);
    }
  );
});
