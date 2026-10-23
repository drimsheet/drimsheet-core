import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { TEntityId } from '@shared/types/uuid';

import getDbQuery from '@infra/persistence/helpers/get-db-query';
import assetLiabilityAccountParticipationQueryRepo from '@infra/persistence/repos/reporting/queries/asset-liability-account-participation.query.repo.impl';

jest.mock('@infra/persistence/helpers/get-db-query');

describe('assetLiabilityAccountParticipationQueryRepo', () => {
  const entityId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const options = { correlationId: 'participation-spec' };
  const execute = jest.fn<
    Promise<{ rows: Record<string, string | boolean | null>[] }>,
    [SQL]
  >();

  beforeEach(() => {
    jest.resetAllMocks();
    jest
      .mocked(getDbQuery)
      .mockReturnValue({ execute } as unknown as ReturnType<typeof getDbQuery>);
    execute.mockResolvedValue({ rows: [] });
  });

  it('reads roots and posting balances in one entity-scoped query without journals or display filters', async () => {
    expect(
      await assetLiabilityAccountParticipationQueryRepo.findAll(
        entityId,
        'NGN',
        options
      )
    ).toEqual([]);
    expect(getDbQuery).toHaveBeenCalledWith(options);
    expect(execute).toHaveBeenCalledTimes(1);
    const compiled = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
    const query = compiled.sql.replace(/\s+/g, ' ');
    expect(compiled.params).toEqual(['NGN', entityId]);
    expect(query).not.toContain(entityId);
    expect(query).toContain('account.accounting_entity_id = $2::uuid');
    expect(query).toContain("account.type IN ('asset', 'liability')");
    expect(query).toContain(
      '(account.is_control_account = false OR account.control_account_id IS NULL)'
    );
    expect(query).toContain('LEFT JOIN core.ledger_account_balances');
    expect(query).toContain('balance.ledger_account_id = account.id');
    expect(query).toContain(
      'balance.accounting_entity_id = account.accounting_entity_id'
    );
    expect(query).toContain('balance.functional_currency_code = $1');
    expect(query).toContain(
      'balance.functional_amount::text AS functional_balance'
    );
    expect(query).toContain('ORDER BY account.code, account.id');
    expect(query).not.toMatch(
      /journal|adjustment|SUM\(|LIMIT|OFFSET|ILIKE|account\.status\s*=|account\.sub_type\s*=/i
    );
  });

  it('decodes exact signed balances and retains missing balances and root identities', async () => {
    const row = {
      id: 'bank',
      name: 'Bank',
      code: '100001',
      type: 'asset',
      sub_type: 'cash_and_cash_equivalent',
      status: 'archived',
      is_control_account: false,
      control_account_id: 'cash-header',
      functional_balance: '-9007199254740993',
    };
    execute.mockResolvedValue({
      rows: [
        row,
        {
          ...row,
          id: 'root',
          is_control_account: true,
          control_account_id: null,
          functional_balance: null,
        },
      ],
    });
    expect(
      await assetLiabilityAccountParticipationQueryRepo.findAll(
        entityId,
        'NGN',
        options
      )
    ).toEqual([
      {
        accountId: 'bank',
        accountName: 'Bank',
        code: '100001',
        type: 'asset',
        subType: 'cash_and_cash_equivalent',
        status: 'archived',
        isControlAccount: false,
        controlAccountId: 'cash-header',
        functionalBalance: -9007199254740993n,
      },
      {
        accountId: 'root',
        accountName: 'Bank',
        code: '100001',
        type: 'asset',
        subType: 'cash_and_cash_equivalent',
        status: 'archived',
        isControlAccount: true,
        controlAccountId: null,
        functionalBalance: null,
      },
    ]);
  });

  it('propagates storage failures', async () => {
    const failure = new Error('read failed');
    execute.mockRejectedValue(failure);
    await expect(
      assetLiabilityAccountParticipationQueryRepo.findAll(
        entityId,
        'NGN',
        options
      )
    ).rejects.toBe(failure);
  });
});
