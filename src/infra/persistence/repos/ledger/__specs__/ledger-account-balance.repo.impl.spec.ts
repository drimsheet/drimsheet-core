import { eq } from 'drizzle-orm';

import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import repoError from '@shared/values/errors/repo.error';

import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import {
  ILedgerAccountBalance,
  ILedgerAccountBalanceAdjustment,
} from '@domain/ledger/types/ledger-account-balance.types';

import {
  ledgerAccountBalanceAdjustmentsInCore,
  ledgerAccountBalancesInCore,
} from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import ledgerAccountBalanceRepo from '@infra/persistence/repos/ledger/ledger-account-balance.repo.impl';
import ledgerAccountBalanceMapper from '@infra/persistence/repos/ledger/mappers/ledger-account-balance.mapper';

jest.mock('@infra/persistence/helpers/get-db-query');
jest.mock(
  '@infra/persistence/repos/ledger/mappers/ledger-account-balance.mapper'
);
jest.mock('drizzle-orm', () => {
  const drizzle =
    jest.requireActual<typeof import('drizzle-orm')>('drizzle-orm');

  return { ...drizzle, eq: jest.fn(drizzle.eq) };
});

describe('ledgerAccountBalanceRepo createWithAdjustments', () => {
  const options = { correlationId: 'promotion-history', tx: {} };
  const balance = { ledgerAccountId: generateUUID() } as ILedgerAccountBalance;
  const balanceRow: ReturnType<typeof ledgerAccountBalanceMapper.toRepo> = {
    ledgerAccountId: balance.ledgerAccountId,
    accountingEntityId: generateUUID(),
    accountMaterializedPath: '401000.401001',
    amount: 1000,
    currencyCode: 'NGN',
    functionalAmount: 500,
    functionalCurrencyCode: 'USD',
    version: 1,
    createdBy: generateUUID(),
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  };
  const adjustments = [
    { id: generateUUID() },
    { id: generateUUID() },
  ] as ILedgerAccountBalanceAdjustment[];
  const rows: ReturnType<typeof ledgerAccountBalanceMapper.toRepoAdjustment>[] =
    adjustments.map((adjustment) => ({
      id: adjustment.id,
      ledgerAccountId: balance.ledgerAccountId,
      journalEntryId: generateUUID(),
      amount: 500,
      currencyCode: 'NGN',
      functionalAmount: 250,
      functionalCurrencyCode: 'USD',
      effect: 'increase',
      createdBy: generateUUID(),
      createdAt: '2026-04-01T00:00:00.000Z',
    }));
  const values = jest.fn();
  const insert = jest.fn().mockReturnValue({ values });
  const transaction = jest.fn(
    async (callback: (tx: { insert: typeof insert }) => Promise<void>) =>
      callback({ insert })
  );

  beforeEach(() => {
    jest.clearAllMocks();
    values.mockReset().mockResolvedValue(undefined);
    jest
      .mocked(getDbQuery)
      .mockReturnValue({ transaction } as unknown as ReturnType<
        typeof getDbQuery
      >);
    jest.mocked(ledgerAccountBalanceMapper.toRepo).mockReturnValue(balanceRow);
    jest
      .mocked(ledgerAccountBalanceMapper.toRepoAdjustment)
      .mockImplementation(
        (adjustment) => rows[adjustments.indexOf(adjustment)]
      );
  });

  it('inserts the prepared balance and history together without applying adjustments again', async () => {
    await ledgerAccountBalanceRepo.createWithAdjustments(
      { balance, adjustments },
      options
    );

    expect(getDbQuery).toHaveBeenCalledWith(options);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert).toHaveBeenNthCalledWith(1, ledgerAccountBalancesInCore);
    expect(insert).toHaveBeenNthCalledWith(
      2,
      ledgerAccountBalanceAdjustmentsInCore
    );
    expect(values).toHaveBeenNthCalledWith(1, balanceRow);
    expect(values).toHaveBeenNthCalledWith(2, rows);
    expect(ledgerAccountBalanceMapper.toRepo).toHaveBeenCalledWith(balance);
    expect(ledgerAccountBalanceMapper.toRepoAdjustment).toHaveBeenCalledTimes(
      2
    );
  });

  it('creates a balance without inserting an empty history', async () => {
    await ledgerAccountBalanceRepo.createWithAdjustments(
      { balance, adjustments: [] },
      options
    );
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(ledgerAccountBalancesInCore);
    expect(values).toHaveBeenCalledWith(balanceRow);
  });

  it.each(['balance', 'adjustments'] as const)(
    'rejects the transaction when the %s insert fails',
    async (failureAt) => {
      const failure = new Error('insert failed');
      if (failureAt === 'adjustments') {
        values.mockResolvedValueOnce(undefined);
      }
      values.mockRejectedValueOnce(failure);
      await expect(
        ledgerAccountBalanceRepo.createWithAdjustments(
          { balance, adjustments },
          options
        )
      ).rejects.toBe(failure);
      expect(insert).toHaveBeenCalledTimes(failureAt === 'balance' ? 1 : 2);
    }
  );
});

describe('ledgerAccountBalanceRepo strict adjustments', () => {
  const newBalance = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    ledgerAccountId: generateUUID(),
    accountingEntityId: generateUUID(),
    version: 2,
  } as ILedgerAccountBalance;
  const adjustment = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: generateUUID(),
  } as ILedgerAccountBalanceAdjustment;
  const balanceRow = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    version: newBalance.version,
  } as never;
  const adjustmentRow = {
    createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
    id: adjustment.id,
  } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(ledgerAccountBalanceMapper.toRepo).mockReturnValue(balanceRow);
    jest
      .mocked(ledgerAccountBalanceMapper.toRepoAdjustment)
      .mockReturnValue(adjustmentRow);
  });

  function mockAdjustment(rowCount: number) {
    const where = jest.fn().mockResolvedValue({ rowCount });
    const set = jest.fn().mockReturnValue({ where });
    const update = jest.fn().mockReturnValue({ set });
    const values = jest.fn().mockResolvedValue(undefined);
    const insert = jest.fn().mockReturnValue({ values });
    const tx = { insert, update };
    jest.mocked(getDbQuery).mockReturnValue({
      transaction: jest.fn(async (callback) => callback(tx as never)),
    } as unknown as ReturnType<typeof getDbQuery>);

    return set;
  }

  it('persists the domain balance and predicates on expectedVersion', async () => {
    const set = mockAdjustment(1);

    await ledgerAccountBalanceRepo.adjustBalance(
      { newBalance, adjustment },
      { correlationId: 'correlation-id', expectedVersion: 1 }
    );

    expect(set).toHaveBeenCalledWith(balanceRow);
    expect(eq).toHaveBeenCalledWith(ledgerAccountBalancesInCore.version, 1);
  });

  it('throws the repository version conflict for a stale adjustment', async () => {
    mockAdjustment(0);

    await expect(
      ledgerAccountBalanceRepo.adjustBalance(
        { newBalance, adjustment },
        { correlationId: 'correlation-id', expectedVersion: 1 }
      )
    ).rejects.toBeInstanceOf(repoError.VersionNotFound);
  });

  it('rejects an incorrect next balance version before querying', async () => {
    await expect(
      ledgerAccountBalanceRepo.adjustBalance(
        { newBalance, adjustment },
        { correlationId: 'correlation-id', expectedVersion: 2 }
      )
    ).rejects.toBeInstanceOf(repoError.VersionMismatch);

    expect(getDbQuery).not.toHaveBeenCalled();
  });
});

describe('ledgerAccountBalanceRepo findAllByAccountIds', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the requested balances', async () => {
    const databaseRow = { ledgerAccountId: generateUUID() };
    const domainBalance = { ledgerAccountId: databaseRow.ledgerAccountId };
    const where = jest.fn().mockResolvedValue([databaseRow]);
    const secondJoin = jest.fn().mockReturnValue({ where });
    const firstJoin = jest.fn().mockReturnValue({ innerJoin: secondJoin });
    const from = jest.fn().mockReturnValue({ innerJoin: firstJoin });
    const select = jest.fn().mockReturnValue({ from });
    (getDbQuery as jest.Mock).mockReturnValue({ select });
    (ledgerAccountBalanceMapper.toDomain as jest.Mock).mockReturnValue(
      domainBalance
    );

    const result = await ledgerAccountBalanceRepo.findAllByAccountIds(
      generateUUID(),
      [databaseRow.ledgerAccountId],
      { correlationId: generateUUID() }
    );

    expect(result).toEqual([domainBalance]);
  });

  it('returns immediately when no account IDs are requested', async () => {
    await expect(
      ledgerAccountBalanceRepo.findAllByAccountIds(generateUUID(), [], {
        correlationId: generateUUID(),
      })
    ).resolves.toEqual([]);

    expect(getDbQuery).not.toHaveBeenCalled();
  });
});

describe('ledgerAccountBalanceRepo update', () => {
  const balance = {
    ledgerAccountId: generateUUID(),
    accountingEntityId: generateUUID(),
    version: 2,
  } as ILedgerAccountBalance;
  const balanceRow = { currencyCode: 'USD', version: 2 } as ReturnType<
    typeof ledgerAccountBalanceMapper.toRepo
  >;
  const options = { correlationId: 'currency-change', expectedVersion: 1 };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(ledgerAccountBalanceMapper.toRepo).mockReturnValue(balanceRow);
  });

  function mockUpdate(rowCount: number) {
    const where = jest.fn().mockResolvedValue({ rowCount });
    const set = jest.fn().mockReturnValue({ where });
    const update = jest.fn().mockReturnValue({ set });
    jest
      .mocked(getDbQuery)
      .mockReturnValue({ update } as unknown as ReturnType<typeof getDbQuery>);
    return { update, set };
  }

  it('writes the prepared balance in the supplied transaction with account, entity and version predicates', async () => {
    const { update, set } = mockUpdate(1);
    await ledgerAccountBalanceRepo.update(balance, options);
    expect(getDbQuery).toHaveBeenCalledWith(options);
    expect(update).toHaveBeenCalledWith(ledgerAccountBalancesInCore);
    expect(set).toHaveBeenCalledWith(balanceRow);
    expect(eq).toHaveBeenCalledWith(
      ledgerAccountBalancesInCore.ledgerAccountId,
      balance.ledgerAccountId
    );
    expect(eq).toHaveBeenCalledWith(
      ledgerAccountBalancesInCore.accountingEntityId,
      balance.accountingEntityId
    );
    expect(eq).toHaveBeenCalledWith(ledgerAccountBalancesInCore.version, 1);
    expect(ledgerAccountBalanceMapper.toRepoAdjustment).not.toHaveBeenCalled();
  });

  it('rejects a stale balance write', async () => {
    mockUpdate(0);
    await expect(
      ledgerAccountBalanceRepo.update(balance, options)
    ).rejects.toBeInstanceOf(repoError.VersionNotFound);
  });

  it('rejects an incorrect next version before querying', async () => {
    await expect(
      ledgerAccountBalanceRepo.update(balance, {
        ...options,
        expectedVersion: 2,
      })
    ).rejects.toBeInstanceOf(repoError.VersionMismatch);
    expect(getDbQuery).not.toHaveBeenCalled();
  });
});

describe('ledgerAccountBalanceRepo.findAllByAccountingEntityId', () => {
  beforeEach(() => jest.clearAllMocks());
  it.each([false, true])(
    'returns every mapped balance for only the requested entity: %s',
    async (hasBalances) => {
      const entityId = generateUUID();
      const row = { ledgerAccountId: generateUUID() };
      const balance = {
        ...row,
        accountingEntityId: entityId,
      } as ILedgerAccountBalance;
      const where = jest.fn().mockResolvedValue(hasBalances ? [row] : []);
      const secondJoin = jest.fn().mockReturnValue({ where });
      const firstJoin = jest.fn().mockReturnValue({ innerJoin: secondJoin });
      const from = jest.fn().mockReturnValue({ innerJoin: firstJoin });
      const select = jest.fn().mockReturnValue({ from });
      jest.mocked(getDbQuery).mockReturnValue({ select } as never);
      jest.mocked(ledgerAccountBalanceMapper.toDomain).mockReturnValue(balance);
      const options = { correlationId: 'entity-balances', tx: {} };
      expect(
        await ledgerAccountBalanceRepo.findAllByAccountingEntityId(
          entityId,
          options
        )
      ).toEqual(hasBalances ? [balance] : []);
      expect(where).toHaveBeenCalledWith(
        eq(ledgerAccountBalancesInCore.accountingEntityId, entityId)
      );
      expect(getDbQuery).toHaveBeenCalledWith(options);
      expect(from).toHaveBeenCalledWith(ledgerAccountBalancesInCore);
      expect(ledgerAccountBalanceMapper.toDomain).toHaveBeenCalledTimes(
        hasBalances ? 1 : 0
      );
    }
  );
});

describe('ledger balance currency trigger error mapping', () => {
  const balance = {
    ledgerAccountId: generateUUID(),
    accountingEntityId: generateUUID(),
    version: 2,
  } as ILedgerAccountBalance;
  const options = { correlationId: 'currency-trigger', expectedVersion: 1 };
  beforeEach(() => jest.clearAllMocks());

  it.each([
    'create',
    'createWithAdjustments',
    'update',
    'adjustBalance',
  ] as const)('maps database rejections from %s', async (operation) => {
    const error = {
      cause: {
        code: '23514',
        constraint: 'ledger_account_balances_entity_functional_currency_check',
      },
    };
    const values = jest.fn().mockRejectedValue(error);
    const where = jest.fn().mockRejectedValue(error);
    const db = {
      insert: jest.fn().mockReturnValue({ values }),
      update: jest
        .fn()
        .mockReturnValue({ set: jest.fn().mockReturnValue({ where }) }),
      transaction: jest.fn().mockRejectedValue(error),
    };
    jest.mocked(getDbQuery).mockReturnValue(db as never);
    const write =
      operation === 'adjustBalance'
        ? ledgerAccountBalanceRepo.adjustBalance(
            {
              newBalance: balance,
              adjustment: {} as ILedgerAccountBalanceAdjustment,
            },
            options
          )
        : operation === 'createWithAdjustments'
          ? ledgerAccountBalanceRepo.createWithAdjustments(
              { balance, adjustments: [] },
              options
            )
          : ledgerAccountBalanceRepo[operation](balance, options);
    await expect(write).rejects.toBeInstanceOf(
      accountingEntityError.FunctionalCurrencyMismatch
    );
  });

  it('preserves unrelated insert failures', async () => {
    const error = new Error('database unavailable');
    jest.mocked(getDbQuery).mockReturnValue({
      insert: jest
        .fn()
        .mockReturnValue({ values: jest.fn().mockRejectedValue(error) }),
    } as never);
    await expect(
      ledgerAccountBalanceRepo.create(balance, options)
    ).rejects.toBe(error);
  });

  it('still persists valid balance inserts', async () => {
    const row = { ledgerAccountId: balance.ledgerAccountId };
    jest
      .mocked(ledgerAccountBalanceMapper.toRepo)
      .mockReturnValue(row as never);
    const values = jest.fn().mockResolvedValue(undefined);
    jest.mocked(getDbQuery).mockReturnValue({
      insert: jest.fn().mockReturnValue({ values }),
    } as never);
    await ledgerAccountBalanceRepo.create(balance, options);
    expect(values).toHaveBeenCalledWith(row);
  });
});
