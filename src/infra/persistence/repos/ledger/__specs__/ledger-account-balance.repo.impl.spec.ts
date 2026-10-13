import { eq } from 'drizzle-orm';

import { TEntityId } from '@shared/types/uuid';
import generateUUID from '@shared/utils/uuid-generator';
import repoError from '@shared/values/errors/repo.error';

import {
  ILedgerAccountBalance,
  ILedgerAccountBalanceAdjustment,
} from '@domain/ledger/types/ledger-account-balance.types';

import { ledgerAccountBalancesInCore } from '@infra/config/drizzle/schema';
import getDbQuery from '@infra/persistence/helpers/get-db-query';
import ledgerAccountBalanceRepo from '@infra/persistence/repos/ledger/ledger-account-balance.repo.impl';
import ledgerAccountBalanceMapper from '@infra/persistence/repos/ledger/mappers/ledger-account-balance.mapper';

jest.mock('../../../helpers/get-db-query');
jest.mock('../mappers/ledger-account-balance.mapper');
jest.mock('drizzle-orm', () => {
  const drizzle =
    jest.requireActual<typeof import('drizzle-orm')>('drizzle-orm');

  return { ...drizzle, eq: jest.fn(drizzle.eq) };
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
