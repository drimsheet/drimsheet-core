import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { TEntityId } from '@shared/types/uuid';

import { ILedgerAccount } from '@domain/ledger/types/ledger.types';

import { ledgerAccountsInCore } from '@infra/config/drizzle/schema';
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

  beforeEach(() => jest.resetAllMocks());

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

  beforeEach(() => jest.resetAllMocks());

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
