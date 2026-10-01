import { EventEmitter } from 'node:events';

import { sql } from 'drizzle-orm';
import { PoolClient, QueryConfig } from 'pg';

import { ITransactionContext } from '@shared/types/repo.types';
import repoError from '@shared/values/errors/repo.error';

import { usersInCore } from '@infra/config/drizzle/schema';
import { postgres } from '@infra/config/postgres.config';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import repoService from '@infra/services/repo.service';

jest.mock('@infra/config/postgres.config', () => ({
  postgres: {
    transaction: jest.fn(),
    $client: { connect: jest.fn() },
  },
}));

type TPostgresTransaction = (
  fn: (tx: ITransactionContext) => Promise<unknown>
) => Promise<unknown>;

describe('repoService', () => {
  const postgresTransaction =
    postgres.transaction as unknown as jest.MockedFunction<TPostgresTransaction>;

  beforeEach(() => {
    postgresTransaction.mockReset();
  });

  it('reuses an existing transaction context', async () => {
    const tx: ITransactionContext = {};
    const transactionFn = jest.fn().mockResolvedValue('completed');

    await expect(repoService.runInTransaction(transactionFn, tx)).resolves.toBe(
      'completed'
    );

    expect(transactionFn).toHaveBeenCalledWith(tx);
    expect(postgresTransaction).not.toHaveBeenCalled();
  });

  it('opens a postgres transaction when no context is supplied', async () => {
    const tx: ITransactionContext = {};
    const transactionFn = jest.fn().mockResolvedValue('completed');
    postgresTransaction.mockImplementation(async (callback) => callback(tx));

    await expect(repoService.runInTransaction(transactionFn)).resolves.toBe(
      'completed'
    );

    expect(postgresTransaction).toHaveBeenCalledWith(expect.any(Function));
    expect(transactionFn).toHaveBeenCalledWith(tx);
  });
});

describe('repoService manual transactions', () => {
  const connect = postgres.$client.connect as unknown as jest.MockedFunction<
    () => Promise<PoolClient>
  >;
  const correlationId = 'manual-transaction-spec';

  function makeClient() {
    const client = Object.assign(new EventEmitter(), {
      query: jest.fn(
        async (query: string | QueryConfig, _params?: unknown[]) => {
          const text = typeof query === 'string' ? query : query.text;
          return {
            command: text.split(' ')[0].toUpperCase(),
            rows: [] as unknown[][],
          };
        }
      ),
      release: jest.fn(),
    });
    connect.mockResolvedValue(client as unknown as PoolClient);
    return client;
  }

  beforeEach(() => jest.resetAllMocks());

  it('executes Drizzle queries with parameter binding and result mapping on the acquired client', async () => {
    const client = makeClient();
    const transaction = await repoService.createTransaction();
    const db = getDbQuery({ correlationId, tx: transaction.context });
    client.query.mockResolvedValueOnce({ command: 'SELECT', rows: [['42']] });

    const rows = await db
      .select({ value: sql<string>`42`.mapWith(Number) })
      .from(usersInCore);
    await db.execute(sql`select ${7}`);
    await transaction.commit();
    await transaction.dispose();

    expect(rows).toEqual([{ value: 42 }]);
    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ text: 'select $1' }),
      [7]
    );
    expect(client.query).toHaveBeenNthCalledWith(4, 'COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith(false);
    expect(client.listenerCount('error')).toBe(0);
    expect(Object.isFrozen(transaction)).toBe(true);
    expect(postgres.transaction).not.toHaveBeenCalled();
  });

  it('rolls back unfinished work and releases only once', async () => {
    const client = makeClient();
    const transaction = await repoService.createTransaction();

    await transaction.dispose();
    await transaction.dispose();

    expect(client.query.mock.calls.map(([query]) => query)).toEqual([
      'BEGIN',
      'ROLLBACK',
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith(false);
    await expect(transaction.commit()).rejects.toBeInstanceOf(
      repoError.TransactionInactive
    );
  });

  it('does not acquire or release a client when acquisition fails', async () => {
    const client = makeClient();
    const failure = new Error('pool unavailable');
    connect.mockRejectedValueOnce(failure);

    await expect(repoService.createTransaction()).rejects.toBe(failure);
    expect(client.query).not.toHaveBeenCalled();
    expect(client.release).not.toHaveBeenCalled();
  });

  it('discards the acquired client when BEGIN fails', async () => {
    const client = makeClient();
    const failure = new Error('BEGIN failed');
    client.query.mockRejectedValueOnce(failure);

    await expect(repoService.createTransaction()).rejects.toBe(failure);
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith(true);
    expect(client.listenerCount('error')).toBe(0);
  });

  it('preserves the operation and rollback errors and discards the client', async () => {
    const client = makeClient();
    const transaction = await repoService.createTransaction();
    const operationError = new Error('write failed');
    const cleanupError = new Error('rollback failed');
    client.query.mockRejectedValueOnce(cleanupError);

    await expect(transaction.dispose(operationError)).rejects.toMatchObject({
      errorKey: 'repo_error_transaction_cleanup_failed_unexpected',
      cause: { operationError, cleanupError },
    });
    await expect(transaction.dispose()).resolves.toBeUndefined();
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith(true);
    expect(client.listenerCount('error')).toBe(0);
  });

  it('reports a rollback failure even when no operation error was supplied', async () => {
    const client = makeClient();
    const transaction = await repoService.createTransaction();
    const cleanupError = new Error('rollback failed');
    client.query.mockRejectedValueOnce(cleanupError);

    await expect(transaction.dispose()).rejects.toMatchObject({
      cause: { operationError: undefined, cleanupError },
    });
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith(true);
  });

  it('discards the client after a failed commit without assuming the commit outcome', async () => {
    const client = makeClient();
    const transaction = await repoService.createTransaction();
    const failure = new Error('connection lost during commit');
    client.query.mockRejectedValueOnce(failure);

    await expect(transaction.commit()).rejects.toBe(failure);
    await expect(transaction.commit()).rejects.toBeInstanceOf(
      repoError.TransactionInactive
    );
    await transaction.dispose(failure);

    expect(client.query.mock.calls.map(([query]) => query)).toEqual([
      'BEGIN',
      'COMMIT',
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith(true);
  });

  it('rejects COMMIT when PostgreSQL reports an aborted transaction was rolled back', async () => {
    const client = makeClient();
    const transaction = await repoService.createTransaction();
    client.query.mockResolvedValueOnce({ command: 'ROLLBACK', rows: [] });

    await expect(transaction.commit()).rejects.toBeInstanceOf(
      repoError.TransactionCommitFailed
    );
    await transaction.dispose();
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith(true);
  });

  it('rejects a second commit after a successful commit', async () => {
    const client = makeClient();
    const transaction = await repoService.createTransaction();

    await transaction.commit();
    await expect(transaction.commit()).rejects.toBeInstanceOf(
      repoError.TransactionInactive
    );
    await transaction.dispose();

    expect(client.query.mock.calls.map(([query]) => query)).toEqual([
      'BEGIN',
      'COMMIT',
    ]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('discards a disconnected client', async () => {
    const client = makeClient();
    const transaction = await repoService.createTransaction();

    client.emit('error', new Error('socket closed'));
    await expect(transaction.commit()).rejects.toBeInstanceOf(
      repoError.TransactionInactive
    );
    await transaction.dispose();

    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledWith(true);
    expect(client.listenerCount('error')).toBe(0);
  });

  it('uses savepoints for nested repository transactions without committing or releasing the outer transaction', async () => {
    const client = makeClient();
    const transaction = await repoService.createTransaction();
    const db = getDbQuery({ correlationId, tx: transaction.context });
    const failure = new Error('nested write failed');

    await db.transaction(async (tx) => {
      await tx.transaction(async (nestedTx) => {
        await nestedTx.execute(sql`select 1`);
      });
    });
    await expect(
      db.transaction(async () => {
        throw failure;
      })
    ).rejects.toBe(failure);
    await repoService.runInTransaction(async (tx) => {
      expect(tx).toBe(transaction.context);
      await getDbQuery({ correlationId, tx }).execute(sql`select 2`);
    }, transaction.context);

    expect(client.release).not.toHaveBeenCalled();
    const commands = client.query.mock.calls.map(([query]) =>
      typeof query === 'string' ? query : query.text
    );
    expect(commands).toEqual([
      'BEGIN',
      'savepoint sp1',
      'savepoint sp2',
      'select 1',
      'release savepoint sp2',
      'release savepoint sp1',
      'savepoint sp1',
      'rollback to savepoint sp1',
      'select 2',
    ]);
    await transaction.dispose();
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(postgres.transaction).not.toHaveBeenCalled();
  });
});
