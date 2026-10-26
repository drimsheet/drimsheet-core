import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { TEntityId } from '@shared/types/uuid';

import getDbQuery from '@infra/persistence/helpers/get-db-query';
import assetAndLiabilityBalancesByCurrencyRepoQuery from '@infra/persistence/repos/ledger/queries/asset-and-liability-balances-by-currency.reporting';

jest.mock('@infra/persistence/helpers/get-db-query');

describe('assetAndLiabilityBalancesByCurrencyRepoQuery', () => {
  const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const options = { correlationId: 'currency-balances-spec' };
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

  it.each(['asset', 'liability'] as const)(
    'reads only %s posting accounts for the entity without double counting controls',
    async (type) => {
      expect(
        await assetAndLiabilityBalancesByCurrencyRepoQuery(
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
      expect(compiled.params).toEqual(['NGN', 'NGN', 'NGN', entityId, type]);
      expect(query).not.toContain(entityId);
      expect(query).toContain('account.accounting_entity_id = $4::uuid');
      expect(query).toContain('account.type = $5');
      expect(query).toContain('account.is_control_account = false');
      expect(query).toContain('LEFT JOIN core.ledger_account_balances');
      expect(query).toContain('balance.ledger_account_id = account.id');
      expect(query).toContain(
        'balance.accounting_entity_id = account.accounting_entity_id'
      );
      expect(query).toContain('balance.functional_currency_code = $2');
      expect(query).toContain(
        'balance.currency_code = COALESCE(account.currency_code, $3)'
      );
      expect(query).toContain(
        'COALESCE(account.currency_code, $1) AS currency_code'
      );
      expect(query).toContain(
        'balance.amount::text, balance.functional_amount::text'
      );
      expect(query).toContain('ORDER BY currency_code, account.id');
      expect(query).not.toMatch(
        /journal|adjustment|SUM\(|LIMIT|OFFSET|account\.status\s*=|account\.sub_type\s*=|account\.deleted_at/i
      );
    }
  );

  it('decodes exact signed minor units, zero and missing balances', async () => {
    execute.mockResolvedValue({
      rows: [
        {
          id: 'bank',
          currency_code: 'USD',
          amount: '-9007199254740993',
          functional_amount: '9007199254740995',
        },
        {
          id: 'zero',
          currency_code: 'NGN',
          amount: '0',
          functional_amount: '0',
        },
        {
          id: 'missing',
          currency_code: 'NGN',
          amount: null,
          functional_amount: null,
        },
      ],
    });
    expect(
      await assetAndLiabilityBalancesByCurrencyRepoQuery(
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
        currencyCode: 'USD',
        amount: -9007199254740993n,
        functionalAmount: 9007199254740995n,
      },
      {
        accountId: 'zero',
        currencyCode: 'NGN',
        amount: 0n,
        functionalAmount: 0n,
      },
      {
        accountId: 'missing',
        currencyCode: 'NGN',
        amount: null,
        functionalAmount: null,
      },
    ]);
  });

  it('propagates storage failures', async () => {
    const failure = new Error('read failed');
    execute.mockRejectedValue(failure);
    await expect(
      assetAndLiabilityBalancesByCurrencyRepoQuery(
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
