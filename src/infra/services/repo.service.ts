import {
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
} from 'drizzle-orm';
import { NodePgDriver, NodePgTransaction } from 'drizzle-orm/node-postgres';
import { PgDialect } from 'drizzle-orm/pg-core';
import { PoolClient } from 'pg';

import {
  IRepoService,
  IRepoTransaction,
} from '@shared/contracts/repo.contract';
import { ITransactionContext } from '@shared/types/repo.types';
import repoError from '@shared/values/errors/repo.error';

import * as relations from '@infra/config/drizzle/relations';
import * as schema from '@infra/config/drizzle/schema';
import { postgres } from '@infra/config/postgres.config';

interface ITransactionState {
  client: PoolClient;
  completed: boolean;
  released: boolean;
  discard: boolean;
  onClientError: () => void;
}

/** Commit once; discard the connection if the outcome is unsuccessful or uncertain. */
function makeCommit(state: ITransactionState): IRepoTransaction['commit'] {
  return async () => {
    const isInactive = state.completed || state.released;
    if (isInactive) throw new repoError.TransactionInactive();

    state.completed = true;

    try {
      const completion = await state.client.query('COMMIT');

      // An aborted PostgreSQL transaction answers COMMIT with ROLLBACK.
      if (completion.command !== 'COMMIT') {
        throw new repoError.TransactionCommitFailed({
          command: completion.command,
        });
      }
    } catch (error) {
      state.discard = true;
      throw error;
    }
  };
}

/** Roll back unfinished work, then release once. Call only after prior work settles. */
function makeDispose(state: ITransactionState): IRepoTransaction['dispose'] {
  return async (operationError) => {
    if (state.released) return;

    try {
      if (!state.completed) await state.client.query('ROLLBACK');
    } catch (cleanupError) {
      state.discard = true;
      throw new repoError.TransactionCleanupFailed({
        operationError,
        cleanupError,
      });
    } finally {
      state.released = true;
      state.client.removeListener('error', state.onClientError);
      state.client.release(state.discard);
    }
  };
}

/** Bind Drizzle to the client; NodePgTransaction makes nested transactions use savepoints. */
function makeTransactionContext(client: PoolClient): ITransactionContext {
  const fullSchema = { ...schema, ...relations };
  const tableConfig = extractTablesRelationalConfig(
    fullSchema,
    createTableRelationsHelpers
  );
  const relationalSchema = {
    fullSchema,
    schema: tableConfig.tables,
    tableNamesMap: tableConfig.tableNamesMap,
  };
  const dialect = new PgDialect();
  const session = new NodePgDriver(client, dialect).createSession(
    relationalSchema
  );

  return new NodePgTransaction(
    dialect,
    session,
    relationalSchema
  ) as ITransactionContext;
}

/** Acquire and begin a manual transaction, discarding its client if setup fails. */
function makeCreateTransaction(): IRepoService['createTransaction'] {
  return async () => {
    const client = await postgres.$client.connect();
    const state: ITransactionState = {
      client,
      completed: false,
      released: false,
      discard: false,
      onClientError: () => {
        state.completed = true;
        state.discard = true;
      },
    };
    client.on('error', state.onClientError);

    try {
      await client.query('BEGIN');

      return Object.freeze({
        context: makeTransactionContext(client),
        commit: makeCommit(state),
        dispose: makeDispose(state),
      });
    } catch (error) {
      client.removeListener('error', state.onClientError);
      client.release(true);
      throw error;
    }
  };
}

/** Join a supplied context, or let Drizzle own a callback transaction's lifecycle. */
function makeRunInTransaction(): IRepoService['runInTransaction'] {
  return async (fn, tx) => {
    if (tx) return await fn(tx);

    return await postgres.transaction(async (tx) => {
      return await fn(tx as ITransactionContext);
    });
  };
}

const repoService: IRepoService = Object.freeze({
  createTransaction: makeCreateTransaction(),
  runInTransaction: makeRunInTransaction(),
});

export default repoService;
