import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { TEntityId } from '@shared/types/uuid';

import getDbQuery from '@infra/persistence/helpers/get-db-query';
import totalBalanceByTypeRepoQuery from '@infra/persistence/repos/ledger/queries/total-balance-by-type.reporting';

jest.mock('@infra/persistence/helpers/get-db-query');

describe('totalBalanceByTypeRepoQuery', () => {
  const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const options = { correlationId: 'total-balance-spec' };
  const execute = jest.fn<
    Promise<{ rows: Record<string, string | null>[] }>,
    [SQL]
  >();

  beforeEach(() => {
    jest.resetAllMocks();
    jest
      .mocked(getDbQuery)
      .mockReturnValue({ execute } as unknown as ReturnType<typeof getDbQuery>);
    execute.mockResolvedValue({ rows: [] });
  });

  it.each(['asset', 'liability', 'equity', 'revenue', 'expense'] as const)(
    'reads only %s root accounts for the entity without counting descendants',
    async (type) => {
      expect(
        await totalBalanceByTypeRepoQuery(
          {
            accountingEntityId: entityId,
            type: type,
            functionalCurrencyCode: 'NGN',
          },
          options
        )
      ).toEqual([]);
      expect(getDbQuery).toHaveBeenCalledWith(options);
      expect(execute).toHaveBeenCalledTimes(1);
      const compiled = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
      const query = compiled.sql.replace(/\s+/g, ' ');
      expect(compiled.params).toEqual(['NGN', 'NGN', entityId, type]);
      expect(query).not.toContain(entityId);
      expect(query).toContain('account.accounting_entity_id = $3::uuid');
      expect(query).toContain('account.type = $4');
      expect(query).toContain('account.control_account_id IS NULL');
      expect(query).toContain('LEFT JOIN core.ledger_account_balances');
      expect(query).toContain('balance.ledger_account_id = account.id');
      expect(query).toContain(
        'balance.accounting_entity_id = account.accounting_entity_id'
      );
      expect(query).toContain('balance.functional_currency_code = $1');
      expect(query).toContain('balance.currency_code = $2');
      expect(query).not.toMatch(
        /is_control_account|account.status|journal|LIMIT|OFFSET/i
      );
    }
  );

  it('decodes exact signed minor units, zero and missing balances', async () => {
    execute.mockResolvedValue({
      rows: [
        {
          id: 'bank',
          functional_amount: '-9007199254740995',
        },
        {
          id: 'zero',
          functional_amount: '0',
        },
        {
          id: 'missing',
          functional_amount: null,
        },
      ],
    });
    expect(
      await totalBalanceByTypeRepoQuery(
        {
          accountingEntityId: entityId,
          type: 'asset',
          functionalCurrencyCode: 'NGN',
        },
        options
      )
    ).toEqual([
      {
        accountId: 'bank',
        functionalAmount: -9007199254740995n,
      },
      {
        accountId: 'zero',
        functionalAmount: 0n,
      },
      {
        accountId: 'missing',
        functionalAmount: null,
      },
    ]);
  });

  it('propagates storage failures', async () => {
    const failure = new Error('read failed');
    execute.mockRejectedValue(failure);
    await expect(
      totalBalanceByTypeRepoQuery(
        {
          accountingEntityId: entityId,
          type: 'asset',
          functionalCurrencyCode: 'NGN',
        },
        options
      )
    ).rejects.toBe(failure);
  });
});
