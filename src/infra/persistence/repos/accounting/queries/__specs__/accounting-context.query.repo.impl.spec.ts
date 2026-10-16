import { SQL } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { PgDialect } from 'drizzle-orm/pg-core';

import { TEntityId } from '@shared/types/uuid';

import * as relations from '@infra/config/drizzle/relations';
import * as schema from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import accountingContextDetailsMapper from '@infra/persistence/repos/accounting/mappers/accounting-context-details.mapper';
import accountingContextQueryRepo from '@infra/persistence/repos/accounting/queries/accounting-context.query.repo.impl';

jest.mock('@infra/persistence/helpers/get-db-query');
jest.mock(
  '@infra/persistence/repos/accounting/mappers/accounting-context-details.mapper'
);

describe('accountingContextQueryRepo', () => {
  const entityId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const options = { correlationId: 'contexts-query' };
  const findMany = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(getDbQuery).mockReturnValue({
      query: { accountingContextsInCore: { findMany } },
    } as unknown as ReturnType<typeof getDbQuery>);
  });

  it.each([0, 2, 60])(
    'returns every one of %s active context results without pagination',
    async (count) => {
      const rows = Array.from({ length: count }, (_, index) => ({
        id: `context-${index}`,
      }));
      findMany.mockResolvedValue(rows);
      jest
        .mocked(accountingContextDetailsMapper.toDetails)
        .mockImplementation(
          (row) =>
            row as unknown as ReturnType<
              typeof accountingContextDetailsMapper.toDetails
            >
        );

      await expect(
        accountingContextQueryRepo.findActiveByAccountingEntityId(
          entityId,
          options
        )
      ).resolves.toEqual(rows);
      expect(getDbQuery).toHaveBeenCalledWith(options);
      expect(findMany).toHaveBeenCalledTimes(1);
      expect(accountingContextDetailsMapper.toDetails).toHaveBeenCalledTimes(
        count
      );
      const config = findMany.mock.calls[0][0];
      expect(config.limit).toBeUndefined();
      expect(config.orderBy).toEqual([
        schema.accountingContextsInCore.createdAt,
        schema.accountingContextsInCore.id,
      ]);
      const predicate = new PgDialect().sqlToQuery(config.where as SQL);
      expect(predicate.sql).toBe(
        '("core"."accounting_contexts"."accounting_entity_id" = $1 and "core"."accounting_contexts"."closed_at" is null)'
      );
      expect(predicate.params).toEqual([entityId]);
      const periods =
        config.with.fiscalYearsInCore.with.accountingPeriodsInCores;
      expect(periods.orderBy).toEqual([
        schema.accountingPeriodsInCore.startDate,
        schema.accountingPeriodsInCore.id,
      ]);
      const periodPredicate = new PgDialect().sqlToQuery(periods.where as SQL);
      expect(periodPredicate.sql).toBe(
        '"core"."accounting_periods"."accounting_entity_id" = $1'
      );
      expect(periodPredicate.params).toEqual([entityId]);
    }
  );

  it('builds one relational query linking each context to its fiscal year and all that year’s periods', async () => {
    findMany.mockResolvedValue([]);
    await accountingContextQueryRepo.findActiveByAccountingEntityId(
      entityId,
      options
    );
    const db = drizzle.mock({ schema: { ...schema, ...relations } });
    const query = db.query.accountingContextsInCore
      .findMany(findMany.mock.calls[0][0])
      .toSQL();
    expect(query.sql).toContain('left join lateral');
    expect(query.sql).toContain('"fiscal_year_id"');
    expect(query.sql).toContain('"closed_at" is null');
    expect(query.sql).toContain('order by');
    expect(query.params).toContain(entityId);
    expect(query.params).not.toContain('open');
  });

  it('propagates database errors', async () => {
    const error = new Error('query failed');
    findMany.mockRejectedValue(error);
    await expect(
      accountingContextQueryRepo.findActiveByAccountingEntityId(
        entityId,
        options
      )
    ).rejects.toBe(error);
    expect(accountingContextDetailsMapper.toDetails).not.toHaveBeenCalled();
  });
});
