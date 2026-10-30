import { eq, inArray, isNull, or, SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { TEntityId } from '@shared/types/uuid';

import { ELedgerAccountBehavior } from '@domain/ledger/types/account-behaviors.tyypes';
import { EAssetSubType } from '@domain/ledger/types/asset-account.types';
import { ELedgerType, ILedgerAccount } from '@domain/ledger/types/ledger.types';

import { ELedgerAccountSortBy } from '@app/ledger/contracts/ledger-account.query.repo.contract';

import {
  ledgerAccountBalancesInCore,
  ledgerAccountsInCore,
} from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import ledgerAccountMapper from '@infra/persistence/repos/ledger/mappers/ledger-account.mapper';
import ledgerAccountQueryRepo from '@infra/persistence/repos/ledger/queries/ledger-account.query.repo.impl';

jest.mock('@infra/persistence/helpers/get-db-query');
jest.mock('@infra/persistence/repos/ledger/mappers/ledger-account.mapper');

describe('ledgerAccountQueryRepo.findSubAccounts', () => {
  const accountId = '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const accountingEntityId =
    '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const options = { correlationId: 'sub-accounts' };

  beforeEach(() => jest.clearAllMocks());

  it.each([0, 60])(
    'returns all %s direct children using a tenant-scoped parent equality query',
    async (count) => {
      const rows = Array.from({ length: count }, (_, id) => ({ id }));
      const orderBy = jest.fn().mockResolvedValue(rows);
      const where = jest.fn().mockReturnValue({ orderBy });
      const leftJoin = jest.fn().mockReturnValue({ where });
      const from = jest.fn().mockReturnValue({ leftJoin });
      const select = jest.fn().mockReturnValue({ from });
      jest
        .mocked(getDbQuery)
        .mockReturnValue({ select } as unknown as ReturnType<
          typeof getDbQuery
        >);
      jest
        .mocked(ledgerAccountMapper.toDomain)
        .mockImplementation((row) => row as unknown as ILedgerAccount);

      await expect(
        ledgerAccountQueryRepo.findSubAccounts(
          accountId,
          accountingEntityId,
          options
        )
      ).resolves.toEqual(rows);

      const predicate = new PgDialect().sqlToQuery(
        where.mock.calls[0][0] as SQL
      );
      expect(predicate.sql).toBe(
        '("core"."ledger_accounts"."accounting_entity_id" = $1 and "core"."ledger_accounts"."control_account_id" = $2)'
      );
      expect(predicate.params).toEqual([accountingEntityId, accountId]);
      expect(getDbQuery).toHaveBeenCalledWith(options);
      expect(from).toHaveBeenCalledWith(ledgerAccountsInCore);
      expect(orderBy).toHaveBeenCalledWith(
        ledgerAccountsInCore.materializedPath
      );
      expect(ledgerAccountMapper.toDomain).toHaveBeenCalledTimes(count);
    }
  );
});

describe('ledgerAccountQueryRepo.findChartOfAccounts', () => {
  const accountingEntityId =
    '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const options = { correlationId: 'sub-accounts' };

  beforeEach(() => jest.clearAllMocks());

  it.each(['asset', 'liability', 'equity', 'revenue', 'expense'] as const)(
    'returns the complete %s class with entity scoping and deterministic ordering',
    async (accountClass) => {
      const count = 60;
      const rows = Array.from({ length: count }, (_, id) => ({ id }));
      const orderBy = jest.fn().mockResolvedValue(rows);
      const where = jest.fn().mockReturnValue({ orderBy });
      const leftJoin = jest.fn().mockReturnValue({ where });
      const from = jest.fn().mockReturnValue({ leftJoin });
      const select = jest.fn().mockReturnValue({ from });
      jest
        .mocked(getDbQuery)
        .mockReturnValue({ select } as unknown as ReturnType<
          typeof getDbQuery
        >);
      jest
        .mocked(ledgerAccountMapper.toDomain)
        .mockImplementation((row) => row as unknown as ILedgerAccount);

      await expect(
        ledgerAccountQueryRepo.findChartOfAccounts(
          accountingEntityId,
          accountClass,
          options
        )
      ).resolves.toEqual(rows);

      const predicate = new PgDialect().sqlToQuery(
        where.mock.calls[0][0] as SQL
      );
      expect(predicate.sql).toBe(
        '("core"."ledger_accounts"."accounting_entity_id" = $1 and "core"."ledger_accounts"."type" = $2)'
      );
      expect(predicate.params).toEqual([accountingEntityId, accountClass]);
      expect(getDbQuery).toHaveBeenCalledWith(options);
      expect(from).toHaveBeenCalledWith(ledgerAccountsInCore);
      expect(orderBy).toHaveBeenCalledWith(
        ledgerAccountsInCore.materializedPath
      );
      expect(ledgerAccountMapper.toDomain).toHaveBeenCalledTimes(count);
    }
  );
});

jest.mock('drizzle-orm', () => {
  const drizzle =
    jest.requireActual<typeof import('drizzle-orm')>('drizzle-orm');
  return {
    ...drizzle,
    eq: jest.fn(drizzle.eq),
    inArray: jest.fn(drizzle.inArray),
    isNull: jest.fn(drizzle.isNull),
    or: jest.fn(drizzle.or),
  };
});

describe('ledgerAccountQueryRepo.findAll', () => {
  const accountingEntityId =
    '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  beforeEach(() => jest.clearAllMocks());
  function mockFindAllQuery(count: number, rows: unknown[] = []) {
    const countWhere = jest.fn().mockResolvedValue([{ count }]);
    const countFrom = jest.fn().mockReturnValue({ where: countWhere });
    const offset = jest.fn().mockResolvedValue(rows);
    const limit = jest.fn().mockReturnValue({ offset });
    const orderBy = jest.fn().mockReturnValue({ limit });
    const dataWhere = jest.fn().mockReturnValue({ orderBy });
    const leftJoin = jest.fn();
    leftJoin.mockReturnValue({ where: dataWhere, leftJoin });
    const dataFrom = jest.fn().mockReturnValue({ leftJoin });
    const select = jest
      .fn()
      .mockReturnValueOnce({ from: countFrom })
      .mockReturnValueOnce({ from: dataFrom });
    (getDbQuery as jest.Mock).mockReturnValue({ select });

    return { countWhere, dataWhere, limit, offset, select, orderBy, leftJoin };
  }

  it.each(['active', 'draft', 'archived'] as const)(
    'filters paginated counts by status %s',
    async (status) => {
      mockFindAllQuery(0);
      await ledgerAccountQueryRepo.findAll(accountingEntityId, {
        correlationId: 'filtered',
        status,
      });
      expect(eq).toHaveBeenCalledWith(ledgerAccountsInCore.status, status);
    }
  );
  it('filters posting candidates by active and draft without changing status-neutral historical reads', async () => {
    mockFindAllQuery(0);
    await ledgerAccountQueryRepo.findAll(accountingEntityId, {
      correlationId: 'filtered',
      statuses: ['active', 'draft'],
    });
    expect(inArray).toHaveBeenCalledWith(ledgerAccountsInCore.status, [
      'active',
      'draft',
    ]);
    jest.clearAllMocks();
    mockFindAllQuery(0);
    await ledgerAccountQueryRepo.findAll(accountingEntityId, {
      correlationId: 'historical',
      statuses: [],
    });
    expect(inArray).not.toHaveBeenCalled();
    expect(eq).not.toHaveBeenCalledWith(
      ledgerAccountsInCore.status,
      expect.anything()
    );
  });

  it('findAll retains a paginated row without a currency relation', async () => {
    const row = { id: 'account-row', currency: null };
    const account = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'account-domain',
      currency: null,
    } as ILedgerAccount;
    const countWhere = jest.fn().mockResolvedValue([{ count: 1 }]);
    const countFrom = jest.fn().mockReturnValue({ where: countWhere });
    const offset = jest.fn().mockResolvedValue([row]);
    const limit = jest.fn().mockReturnValue({ offset });
    const orderBy = jest.fn().mockReturnValue({ limit });
    const dataWhere = jest.fn().mockReturnValue({ orderBy });
    const leftJoin = jest.fn().mockReturnValue({ where: dataWhere });
    const dataFrom = jest.fn().mockReturnValue({ leftJoin });
    const select = jest
      .fn()
      .mockReturnValueOnce({ from: countFrom })
      .mockReturnValueOnce({ from: dataFrom });
    (getDbQuery as jest.Mock).mockReturnValue({ select });
    (ledgerAccountMapper.toDomain as jest.Mock).mockReturnValue(account);

    const result = await ledgerAccountQueryRepo.findAll(accountingEntityId, {
      correlationId: 'correlation-id',
    });

    expect(leftJoin).toHaveBeenCalled();
    expect(result.data).toEqual([account]);
  });

  it('findAll applies plural posting restrictions and fixed-or-null currency before count and pagination', async () => {
    const row = { id: 'account-row', currency: null };
    const account = {
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: 'account-domain',
      currency: null,
    } as ILedgerAccount;
    const query = mockFindAllQuery(25, [row]);
    (ledgerAccountMapper.toDomain as jest.Mock).mockReturnValue(account);

    const result = await ledgerAccountQueryRepo.findAll(accountingEntityId, {
      correlationId: 'correlation-id',
      types: [ELedgerType.Revenue, ELedgerType.Liability],
      subTypes: [EAssetSubType.CashAndCashEquivalent],
      behaviors: [ELedgerAccountBehavior.Bank],
      currencyCodes: ['USD', null],
      isControlAccount: false,
      limit: 10,
      offset: 10,
    });

    expect(inArray).toHaveBeenCalledWith(ledgerAccountsInCore.type, [
      ELedgerType.Revenue,
      ELedgerType.Liability,
    ]);
    expect(inArray).toHaveBeenCalledWith(ledgerAccountsInCore.subType, [
      EAssetSubType.CashAndCashEquivalent,
    ]);
    expect(inArray).toHaveBeenCalledWith(ledgerAccountsInCore.behavior, [
      ELedgerAccountBehavior.Bank,
    ]);
    expect(inArray).toHaveBeenCalledWith(ledgerAccountsInCore.currencyCode, [
      'USD',
    ]);
    expect(isNull).toHaveBeenCalledWith(ledgerAccountsInCore.currencyCode);
    expect(or).toHaveBeenCalledWith(expect.anything(), expect.anything());
    expect(eq).toHaveBeenCalledWith(
      ledgerAccountsInCore.isControlAccount,
      false
    );
    expect(query.countWhere).toHaveBeenCalledWith(expect.anything());
    expect(query.dataWhere).toHaveBeenCalledWith(
      query.countWhere.mock.calls[0][0]
    );
    expect(query.limit).toHaveBeenCalledWith(10);
    expect(query.offset).toHaveBeenCalledWith(10);
    expect(result).toEqual({
      data: [account],
      meta: { page: 2, limit: 10, total: 25, totalPages: 3 },
    });
  });

  it('findAll preserves unfiltered reads and skips the data query when no rows match', async () => {
    const query = mockFindAllQuery(0);

    const result = await ledgerAccountQueryRepo.findAll(accountingEntityId, {
      correlationId: 'correlation-id',
      ids: [],
      statuses: [],
      types: [],
      subTypes: [],
      behaviors: [],
      currencyCodes: [],
    });

    expect(inArray).not.toHaveBeenCalled();
    expect(isNull).not.toHaveBeenCalled();
    const predicate = new PgDialect().sqlToQuery(
      query.countWhere.mock.calls[0][0] as SQL
    );
    expect(predicate.sql).toBe(
      '"core"."ledger_accounts"."accounting_entity_id" = $1'
    );
    expect(predicate.params).toEqual([accountingEntityId]);
    expect(query.select).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      data: [],
      meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
  });

  it('findAll supports a fixed-currency-only filter', async () => {
    mockFindAllQuery(0);

    await ledgerAccountQueryRepo.findAll(accountingEntityId, {
      correlationId: 'correlation-id',
      currencyCodes: ['USD'],
    });

    expect(inArray).toHaveBeenCalledWith(ledgerAccountsInCore.currencyCode, [
      'USD',
    ]);
    expect(isNull).not.toHaveBeenCalled();
  });

  it('findAll supports a null-currency-only filter', async () => {
    mockFindAllQuery(0);

    await ledgerAccountQueryRepo.findAll(accountingEntityId, {
      correlationId: 'correlation-id',
      currencyCodes: [null],
    });

    expect(inArray).not.toHaveBeenCalled();
    expect(isNull).toHaveBeenCalledWith(ledgerAccountsInCore.currencyCode);
  });

  it('preserves scalar filters, account IDs, search and transaction options', async () => {
    const query = mockFindAllQuery(1);
    const accountId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
    const options = {
      correlationId: 'filtered',
      tx: {},
      ids: [accountId],
      type: ELedgerType.Asset,
      subType: EAssetSubType.CashAndCashEquivalent,
      behavior: ELedgerAccountBehavior.Bank,
      search: 'Operations',
    };

    await ledgerAccountQueryRepo.findAll(accountingEntityId, options);

    expect(getDbQuery).toHaveBeenCalledWith(options);
    const predicate = new PgDialect().sqlToQuery(
      query.countWhere.mock.calls[0][0] as SQL
    );
    expect(predicate.sql).toBe(
      '("core"."ledger_accounts"."accounting_entity_id" = $1 and ' +
        '"core"."ledger_accounts"."id" in ($2) and ' +
        '"core"."ledger_accounts"."type" = $3 and ' +
        '"core"."ledger_accounts"."sub_type" = $4 and ' +
        '"core"."ledger_accounts"."behavior" = $5 and ' +
        '("core"."ledger_accounts"."name" ilike $6 or ' +
        '"core"."ledger_accounts"."code" ilike $7))'
    );
    expect(predicate.params).toEqual([
      accountingEntityId,
      accountId,
      ELedgerType.Asset,
      EAssetSubType.CashAndCashEquivalent,
      ELedgerAccountBehavior.Bank,
      '%Operations%',
      '%Operations%',
    ]);
    expect(query.dataWhere).toHaveBeenCalledWith(
      query.countWhere.mock.calls[0][0]
    );
  });

  it.each([
    {
      orderBy: ELedgerAccountSortBy.AccountName,
      column: '"core"."ledger_accounts"."name"',
      joins: 1,
    },
    {
      orderBy: ELedgerAccountSortBy.CreatedAt,
      column: '"core"."ledger_accounts"."created_at"',
      joins: 1,
    },
    {
      orderBy: ELedgerAccountSortBy.Balance,
      column: '"core"."ledger_account_balances"."functional_amount"',
      joins: 2,
    },
  ])(
    'preserves $orderBy ordering and joins',
    async ({ orderBy, column, joins }) => {
      const query = mockFindAllQuery(1);

      await ledgerAccountQueryRepo.findAll(accountingEntityId, {
        correlationId: 'ordered',
        orderBy,
        sortDirection: 'asc',
      });

      const ordering = new PgDialect().sqlToQuery(
        query.orderBy.mock.calls[0][0] as SQL
      );
      expect(ordering.sql).toBe(`${column} asc`);
      expect(query.leftJoin).toHaveBeenCalledTimes(joins);
      if (orderBy === ELedgerAccountSortBy.Balance) {
        expect(query.leftJoin).toHaveBeenLastCalledWith(
          ledgerAccountBalancesInCore,
          expect.anything()
        );
      }
    }
  );

  it('returns an empty page when the count query returns no row', async () => {
    const query = mockFindAllQuery(0);
    query.countWhere.mockResolvedValue([]);

    const result = await ledgerAccountQueryRepo.findAll(accountingEntityId, {
      correlationId: 'empty-count',
    });

    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(0);
    expect(query.select).toHaveBeenCalledTimes(1);
  });
});
