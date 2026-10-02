/* eslint-disable local/require-transaction-disposal -- Creates each test transaction in beforeEach and disposes it in afterEach. */
import { EventEmitter } from 'node:events';

import { PoolClient, QueryConfig } from 'pg';

import { IRepoTransaction } from '@shared/contracts/repo.contract';
import { ERepoLock, IReadRepoOptions } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import repoError from '@shared/values/errors/repo.error';

import { ELedgerType } from '@domain/ledger/types/ledger.types';

import { postgres } from '@infra/config/postgres.config';
import accountingEntityRepo from '@infra/persistence/repos/accounting/accounting-entity.repo.impl';
import accountingPeriodRepo from '@infra/persistence/repos/accounting/accounting-period.repo.impl';
import counterpartyRepo from '@infra/persistence/repos/counterparty/counterparty.repo.impl';
import journalLineRepo from '@infra/persistence/repos/journal-entry/journal-line.repo.impl';
import bankAccountRepo from '@infra/persistence/repos/ledger/bank-account.repo.impl';
import ledgerAccountRepo from '@infra/persistence/repos/ledger/ledger-account.repo.impl';
import userSessionRepo from '@infra/persistence/repos/user/user-session.repo.impl';
import userRepo from '@infra/persistence/repos/user/user.repo.impl';
import repoService from '@infra/services/repo.service';

jest.mock('@infra/config/postgres.config', () => ({
  postgres: { $client: { connect: jest.fn() } },
}));

const id = 'a1111111-1111-4111-8111-111111111111' as TEntityId;
const reads: Array<{
  name: string;
  read: (options: IReadRepoOptions) => Promise<unknown>;
  lockTarget?: string;
  queryCount?: number;
}> = [
  {
    name: 'journalLine.findAllByCounterpartyId',
    read: (options) => journalLineRepo.findAllByCounterpartyId(id, id, options),
    lockTarget: ' of "journal_lines"',
  },
  {
    name: 'counterparty.findById',
    read: (options) => counterpartyRepo.findById(id, id, options),
  },
  {
    name: 'accountingEntity.findById',
    read: (options) => accountingEntityRepo.findById(id, options),
  },
  {
    name: 'accountingPeriod.findByDate',
    read: (options) =>
      accountingPeriodRepo.findByDate(id, new Date('2026-01-01'), options),
  },
  {
    name: 'bankAccount.findOne',
    read: (options) =>
      bankAccountRepo.findOne('Test Bank', '0123456789', options),
  },
  {
    name: 'bankAccount.findByLedgerAccountId',
    read: (options) => bankAccountRepo.findByLedgerAccountId(id, options),
  },
  {
    name: 'ledgerAccount.findById',
    read: (options) => ledgerAccountRepo.findById(id, id, options),
    lockTarget: ' of "ledger_accounts"',
  },
  {
    name: 'ledgerAccount.findByCode',
    read: (options) => ledgerAccountRepo.findByCode('100000', id, options),
    lockTarget: ' of "ledger_accounts"',
  },
  {
    name: 'ledgerAccount.findLatestBySubType',
    read: (options) =>
      ledgerAccountRepo.findLatestBySubType(
        id,
        ELedgerType.Asset,
        'cash_and_cash_equivalent',
        options
      ),
  },
  {
    name: 'user.findByEmail',
    read: (options) => userRepo.findByEmail('test@example.com', options),
  },
  {
    name: 'user.findById',
    read: (options) => userRepo.findById(id, options),
  },
  {
    name: 'userSession.findByRefreshToken',
    read: (options) =>
      userSessionRepo.findByRefreshToken(id, 'refresh-token', options),
  },
];

describe.each(reads)(
  '$name locking SQL',
  ({ read, lockTarget = '', queryCount = 1 }) => {
    const connect = postgres.$client.connect as unknown as jest.MockedFunction<
      () => Promise<PoolClient>
    >;
    const query = jest.fn(async (statement: string | QueryConfig) => ({
      command: typeof statement === 'string' ? statement : 'SELECT',
      rows:
        typeof statement !== 'string' && statement.text.includes('count(*)')
          ? [[1]]
          : [],
    }));
    const release = jest.fn();
    let transaction: IRepoTransaction;

    beforeEach(async () => {
      jest.clearAllMocks();
      const client = Object.assign(new EventEmitter(), { query, release });
      connect.mockResolvedValue(client as unknown as PoolClient);
      transaction = await repoService.createTransaction();
      query.mockClear();
    });

    afterEach(async () => {
      await transaction.dispose();
    });

    it.each(Object.values(ERepoLock))(
      'uses FOR %s on the manual transaction client',
      async (lock) => {
        await read({
          correlationId: 'lock-spec',
          tx: transaction.context,
          lock,
        });

        expect(query).toHaveBeenCalledTimes(queryCount);
        const statement = query.mock.calls[queryCount - 1][0] as QueryConfig;
        expect(statement.text.slice(statement.text.lastIndexOf(' for '))).toBe(
          ` for ${lock}${lockTarget}`
        );
        expect(release).not.toHaveBeenCalled();

        await transaction.commit();
        expect(query).toHaveBeenLastCalledWith('COMMIT');
      }
    );

    it('does not add a lock when none is requested', async () => {
      await read({ correlationId: 'lock-spec', tx: transaction.context });

      const statement = query.mock.calls[queryCount - 1][0] as QueryConfig;
      expect(statement.text).not.toMatch(
        / for (update|no key update|share|key share)/
      );
    });

    it('rejects a lock without a transaction before executing SQL', async () => {
      await expect(
        read({ correlationId: 'lock-spec', lock: ERepoLock.Update })
      ).rejects.toBeInstanceOf(repoError.TransactionRequired);
      expect(query).not.toHaveBeenCalled();
    });
  }
);
